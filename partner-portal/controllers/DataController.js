import { getUserDataModel } from '../models/UserData.js';
import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';
import consentValidator from '../services/consentValidator.js';
import bankApiClient from '../services/bankApiClient.js';
import crypto from 'crypto';

class DataController {
  constructor() {
    this.userDataModel = getUserDataModel();
    this.auditModel = getPartnerAuditLogModel();
  }

  /**
   * Request user data from bank API
   * POST /api/v1/partner-portal/data/request
   */
  async requestData(req, res) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      const { consent_id, data_fields } = req.body;
      const partner_id = req.partner?.partnerId; // From auth middleware

      // Validate required fields
      if (!consent_id) {
        return res.status(400).json({
          success: false,
          error: 'consent_id is required'
        });
      }

      // Validate consent exists and is active
      const validationResult = await consentValidator.validateConsent(consent_id, partner_id);
      
      if (!validationResult.isValid) {
        await this.auditModel.createAuditLog({
          event_type: 'DATA_REQUESTED',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: `Data request failed: ${validationResult.reason}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          request_id: requestId,
          response_time_ms: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid consent',
          reason: validationResult.reason,
          message: validationResult.message
        });
      }

      // Validate requested data fields against consent
      const requestedFields = data_fields || validationResult.consent.allowedDataFields;
      const fieldValidation = await consentValidator.validateDataFields(consent_id, requestedFields);
      
      if (!fieldValidation.isValid) {
        await this.auditModel.createAuditLog({
          event_type: 'DATA_REQUESTED',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: `Unauthorized data fields requested: ${fieldValidation.unauthorizedFields?.join(', ')}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          request_id: requestId,
          response_time_ms: Date.now() - startTime
        });

        return res.status(403).json({
          success: false,
          error: 'Unauthorized data fields',
          unauthorized_fields: fieldValidation.unauthorizedFields,
          allowed_fields: fieldValidation.allowedFields
        });
      }

      // Check if data already exists and is not expired
      const existingData = await this.userDataModel.findByConsentAndPartner(consent_id, partner_id);
      
      if (existingData) {
        await existingData.recordAccess();

        await this.auditModel.createAuditLog({
          event_type: 'DATA_ACCESS',
          consent_id,
          partner_id,
          status: 'SUCCESS',
          message: 'Existing data accessed',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          request_id: requestId,
          response_time_ms: Date.now() - startTime
        });

        return res.json({
          success: true,
          message: 'Data already available',
          data_available: true,
          received_at: existingData.received_at,
          expires_at: existingData.expires_at,
          data_fields: existingData.data_fields,
          access_count: existingData.access_count
        });
      }

      // Request data from bank API
      const bankResponse = await bankApiClient.requestUserData(
        consent_id,
        partner_id,
        requestedFields
      );

      if (!bankResponse.success) {
        await this.auditModel.createAuditLog({
          event_type: 'DATA_REQUESTED',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: 'Bank API request failed',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          request_id: requestId,
          response_time_ms: Date.now() - startTime
        });

        return res.status(502).json({
          success: false,
          error: 'Bank API request failed',
          message: 'Unable to retrieve data from bank'
        });
      }

      // Calculate expiry date based on consent retention period
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validationResult.consent.retentionPeriod);

      // Store encrypted data in SECONDARY database
      const userData = new this.userDataModel({
        consent_id,
        partner_id,
        encrypted_data: bankResponse.encrypted_data,
        data_hash: bankResponse.data_hash,
        received_at: bankResponse.timestamp,
        expires_at: expiryDate,
        data_fields: requestedFields,
        bank_signature: bankResponse.bank_signature,
        status: 'ACTIVE',
        bank_request_id: bankResponse.request_id,
        metadata: new Map([
          ['bank_response_id', bankResponse.bank_response_id],
          ['encryption_algorithm', 'RSA-OAEP-256'],
          ['request_source', req.ip]
        ])
      });

      await userData.save();

      // Log successful data request
      await this.auditModel.createAuditLog({
        event_type: 'DATA_REQUESTED',
        consent_id,
        partner_id,
        status: 'SUCCESS',
        message: 'User data successfully requested and stored',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        request_id: requestId,
        response_time_ms: Date.now() - startTime,
        data_size_bytes: userData.data_size_bytes,
        additional_data: new Map([
          ['data_fields', requestedFields.join(',')],
          ['bank_request_id', bankResponse.request_id]
        ])
      });

      res.status(201).json({
        success: true,
        message: 'Data request successful',
        data: {
          consent_id,
          received_at: userData.received_at,
          expires_at: userData.expires_at,
          data_fields: userData.data_fields,
          data_size_bytes: userData.data_size_bytes,
          status: userData.status
        }
      });

    } catch (error) {
      console.error('Data request error:', error);

      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: req.body?.consent_id || 'unknown',
        partner_id: req.partner?.partnerId || 'unknown',
        status: 'FAILURE',
        message: `Data request failed: ${error.message}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        request_id: requestId,
        response_time_ms: Date.now() - startTime,
        error_code: 'DATA_REQUEST_ERROR',
        error_details: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process data request'
      });
    }
  }

  /**
   * Get decrypted user data
   * GET /api/v1/partner-portal/data/:consent_id
   */
  async getData(req, res) {
    const startTime = Date.now();

    try {
      const { consent_id } = req.params;
      const partner_id = req.partner?.partnerId;

      // Find user data
      const userData = await this.userDataModel.findByConsentAndPartner(consent_id, partner_id);

      if (!userData) {
        await this.auditModel.createAuditLog({
          event_type: 'DATA_ACCESS',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: 'Data not found or expired',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          response_time_ms: Date.now() - startTime
        });

        return res.status(404).json({
          success: false,
          error: 'Data not found',
          message: 'No active data found for this consent'
        });
      }

      // Validate consent is still active
      const validationResult = await consentValidator.validateConsent(consent_id, partner_id);
      
      if (!validationResult.isValid) {
        // Mark data as expired if consent is no longer valid
        await userData.markExpired();

        await this.auditModel.createAuditLog({
          event_type: 'DATA_ACCESS',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: `Data access denied: ${validationResult.reason}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          response_time_ms: Date.now() - startTime
        });

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          reason: validationResult.reason,
          message: validationResult.message
        });
      }

      // Decrypt data in memory (never store decrypted)
      let decryptedData;
      try {
        decryptedData = bankApiClient.decryptResponseData(userData.encrypted_data);
      } catch (decryptError) {
        await this.auditModel.createAuditLog({
          event_type: 'SYSTEM_ERROR',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: `Data decryption failed: ${decryptError.message}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          response_time_ms: Date.now() - startTime,
          error_code: 'DECRYPTION_ERROR'
        });

        return res.status(500).json({
          success: false,
          error: 'Decryption failed',
          message: 'Unable to decrypt user data'
        });
      }

      // Record data access
      await userData.recordAccess();

      // Log successful data access
      await this.auditModel.createAuditLog({
        event_type: 'DATA_ACCESS',
        consent_id,
        partner_id,
        status: 'SUCCESS',
        message: 'User data successfully accessed',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        response_time_ms: Date.now() - startTime,
        additional_data: new Map([
          ['access_count', userData.access_count.toString()],
          ['data_age_hours', userData.ageInHours.toString()]
        ])
      });

      // Parse decrypted data
      const parsedData = JSON.parse(decryptedData);

      res.json({
        success: true,
        data: {
          consent_id,
          user_data: parsedData,
          metadata: {
            received_at: userData.received_at,
            expires_at: userData.expires_at,
            data_fields: userData.data_fields,
            access_count: userData.access_count,
            last_accessed_at: userData.last_accessed_at,
            data_hash: userData.data_hash,
            status: userData.status
          }
        }
      });

    } catch (error) {
      console.error('Get data error:', error);

      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: req.params?.consent_id || 'unknown',
        partner_id: req.partner?.partnerId || 'unknown',
        status: 'FAILURE',
        message: `Data access failed: ${error.message}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        response_time_ms: Date.now() - startTime,
        error_code: 'DATA_ACCESS_ERROR',
        error_details: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve user data'
      });
    }
  }

  /**
   * Get data status for a consent
   * GET /api/v1/partner-portal/data/:consent_id/status
   */
  async getDataStatus(req, res) {
    try {
      const { consent_id } = req.params;
      const partner_id = req.partner?.partnerId;

      const userData = await this.userDataModel.findOne({
        consent_id,
        partner_id
      });

      if (!userData) {
        return res.json({
          success: true,
          status: 'NOT_AVAILABLE',
          message: 'No data found for this consent'
        });
      }

      const isExpired = userData.expires_at <= new Date();
      const status = isExpired ? 'EXPIRED' : userData.status;

      res.json({
        success: true,
        status,
        data: {
          consent_id,
          received_at: userData.received_at,
          expires_at: userData.expires_at,
          data_fields: userData.data_fields,
          access_count: userData.access_count,
          last_accessed_at: userData.last_accessed_at,
          is_expired: isExpired,
          age_in_hours: userData.ageInHours
        }
      });

    } catch (error) {
      console.error('Get data status error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get partner's data statistics
   * GET /api/v1/partner-portal/data/stats
   */
  async getDataStats(req, res) {
    try {
      const partner_id = req.partner?.partnerId;

      const stats = await this.userDataModel.getPartnerStats(partner_id);
      
      const summary = stats.reduce((acc, stat) => {
        acc[stat._id.toLowerCase()] = {
          count: stat.count,
          total_size_bytes: stat.totalSize,
          avg_access_count: Math.round(stat.avgAccessCount * 100) / 100
        };
        return acc;
      }, {});

      const totalRecords = stats.reduce((sum, stat) => sum + stat.count, 0);
      const totalSize = stats.reduce((sum, stat) => sum + stat.totalSize, 0);

      res.json({
        success: true,
        statistics: {
          partner_id,
          total_records: totalRecords,
          total_size_bytes: totalSize,
          by_status: summary,
          generated_at: new Date()
        }
      });

    } catch (error) {
      console.error('Get data stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * List all data for partner
   * GET /api/v1/partner-portal/data
   */
  async listData(req, res) {
    try {
      const partner_id = req.partner?.partnerId;
      const { status, page = 1, limit = 50, sort = '-received_at' } = req.query;

      const query = { partner_id };
      if (status) {
        query.status = status.toUpperCase();
      }

      const options = {
        limit: Math.min(parseInt(limit), 100),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: sort
      };

      const [dataRecords, total] = await Promise.all([
        this.userDataModel.find(query, {
          consent_id: 1,
          received_at: 1,
          expires_at: 1,
          data_fields: 1,
          status: 1,
          access_count: 1,
          last_accessed_at: 1,
          data_size_bytes: 1
        }, options),
        this.userDataModel.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: dataRecords.map(record => ({
          consent_id: record.consent_id,
          received_at: record.received_at,
          expires_at: record.expires_at,
          data_fields: record.data_fields,
          status: record.status,
          access_count: record.access_count,
          last_accessed_at: record.last_accessed_at,
          data_size_bytes: record.data_size_bytes,
          is_expired: record.expires_at <= new Date()
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / parseInt(limit)),
          total_records: total,
          has_next: parseInt(page) * parseInt(limit) < total,
          has_prev: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('List data error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new DataController();
