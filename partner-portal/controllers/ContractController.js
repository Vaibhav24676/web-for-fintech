import { getContractLogModel } from '../models/ContractLog.js';
import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';
import consentValidator from '../services/consentValidator.js';

class ContractController {
  constructor() {
    this.contractLogModel = getContractLogModel();
    this.auditModel = getPartnerAuditLogModel();
  }

  /**
   * Webhook endpoint to receive contract signing notifications
   * POST /api/v1/partner-portal/webhook/consent-received
   */
  async receiveConsentWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      const {
        consent_id,
        user_id,
        contract_purpose,
        contract_expiry,
        signed_at,
        partner_id,
        allowed_data_fields,
        retention_period_days
      } = req.body;

      // Validate required fields
      if (!consent_id || !user_id || !contract_purpose || !contract_expiry || !partner_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          required: ['consent_id', 'user_id', 'contract_purpose', 'contract_expiry', 'partner_id']
        });
      }

      // Validate consent exists in PRIMARY database
      const validationResult = await consentValidator.validateConsent(consent_id, partner_id);
      
      if (!validationResult.isValid) {
        await this.auditModel.createAuditLog({
          event_type: 'CONTRACT_RECEIVED',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: `Consent validation failed: ${validationResult.reason}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          response_time_ms: Date.now() - startTime
        });

        return res.status(400).json({
          success: false,
          error: 'Invalid consent',
          reason: validationResult.reason,
          message: validationResult.message
        });
      }

      // Check if contract already exists
      const existingContract = await this.contractLogModel.findOne({ consent_id });
      
      if (existingContract) {
        await this.auditModel.createAuditLog({
          event_type: 'CONTRACT_RECEIVED',
          consent_id,
          partner_id,
          status: 'FAILURE',
          message: 'Contract already exists for this consent',
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          response_time_ms: Date.now() - startTime
        });

        return res.status(409).json({
          success: false,
          error: 'Contract already exists',
          existing_contract: {
            consent_id: existingContract.consent_id,
            signed_at: existingContract.signed_at,
            status: existingContract.status
          }
        });
      }

      // Create contract log entry
      const contractLog = new this.contractLogModel({
        consent_id,
        user_id,
        contract_purpose,
        signed_at: signed_at ? new Date(signed_at) : new Date(),
        contract_expiry: new Date(contract_expiry),
        partner_id,
        status: 'ACTIVE',
        allowed_data_fields: allowed_data_fields || validationResult.consent.allowedDataFields,
        retention_period_days: retention_period_days || validationResult.consent.retentionPeriod,
        webhook_received_at: new Date(),
        metadata: new Map([
          ['webhook_source', req.get('X-Webhook-Source') || 'unknown'],
          ['api_version', req.get('X-API-Version') || 'v1']
        ])
      });

      await contractLog.save();

      // Log successful contract receipt
      await this.auditModel.createAuditLog({
        event_type: 'CONTRACT_RECEIVED',
        consent_id,
        partner_id,
        status: 'SUCCESS',
        message: 'Contract successfully received and stored',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        response_time_ms: Date.now() - startTime,
        additional_data: new Map([
          ['contract_purpose', contract_purpose],
          ['retention_period', retention_period_days?.toString() || ''],
          ['data_fields_count', (allowed_data_fields?.length || 0).toString()]
        ])
      });

      res.status(201).json({
        success: true,
        message: 'Contract received successfully',
        contract: {
          consent_id: contractLog.consent_id,
          status: contractLog.status,
          signed_at: contractLog.signed_at,
          contract_expiry: contractLog.contract_expiry,
          partner_id: contractLog.partner_id
        }
      });

    } catch (error) {
      console.error('Contract webhook error:', error);

      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: req.body?.consent_id || 'unknown',
        partner_id: req.body?.partner_id || 'unknown',
        status: 'FAILURE',
        message: `Contract webhook failed: ${error.message}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        response_time_ms: Date.now() - startTime,
        error_code: 'WEBHOOK_ERROR',
        error_details: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process contract webhook'
      });
    }
  }

  /**
   * Get contract details by consent ID
   * GET /api/v1/partner-portal/contracts/:consent_id
   */
  async getContract(req, res) {
    try {
      const { consent_id } = req.params;
      const partner_id = req.partner?.partnerId; // From auth middleware

      const contract = await this.contractLogModel.findOne({
        consent_id,
        partner_id
      });

      if (!contract) {
        return res.status(404).json({
          success: false,
          error: 'Contract not found'
        });
      }

      res.json({
        success: true,
        contract: {
          consent_id: contract.consent_id,
          user_id: contract.user_id,
          contract_purpose: contract.contract_purpose,
          signed_at: contract.signed_at,
          contract_expiry: contract.contract_expiry,
          partner_id: contract.partner_id,
          status: contract.status,
          allowed_data_fields: contract.allowed_data_fields,
          retention_period_days: contract.retention_period_days,
          is_expired: contract.isExpired
        }
      });

    } catch (error) {
      console.error('Get contract error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get all contracts for a partner
   * GET /api/v1/partner-portal/contracts
   */
  async getPartnerContracts(req, res) {
    try {
      const partner_id = req.partner?.partnerId;
      const { status, page = 1, limit = 50, sort = '-signed_at' } = req.query;

      const query = { partner_id };
      if (status) {
        query.status = status.toUpperCase();
      }

      const options = {
        limit: Math.min(parseInt(limit), 100),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: sort
      };

      const [contracts, total] = await Promise.all([
        this.contractLogModel.find(query, null, options),
        this.contractLogModel.countDocuments(query)
      ]);

      res.json({
        success: true,
        contracts: contracts.map(contract => ({
          consent_id: contract.consent_id,
          user_id: contract.user_id,
          contract_purpose: contract.contract_purpose,
          signed_at: contract.signed_at,
          contract_expiry: contract.contract_expiry,
          status: contract.status,
          allowed_data_fields: contract.allowed_data_fields,
          is_expired: contract.isExpired
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
      console.error('Get partner contracts error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Update contract status (revoke)
   * PATCH /api/v1/partner-portal/contracts/:consent_id
   */
  async updateContract(req, res) {
    try {
      const { consent_id } = req.params;
      const { status } = req.body;
      const partner_id = req.partner?.partnerId;

      if (!['REVOKED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          allowed_statuses: ['REVOKED']
        });
      }

      const contract = await this.contractLogModel.findOneAndUpdate(
        { consent_id, partner_id },
        { status },
        { new: true }
      );

      if (!contract) {
        return res.status(404).json({
          success: false,
          error: 'Contract not found'
        });
      }

      await this.auditModel.createAuditLog({
        event_type: 'CONTRACT_RECEIVED',
        consent_id,
        partner_id,
        status: 'SUCCESS',
        message: `Contract status updated to ${status}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Contract updated successfully',
        contract: {
          consent_id: contract.consent_id,
          status: contract.status,
          updated_at: contract.updatedAt
        }
      });

    } catch (error) {
      console.error('Update contract error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get contract statistics for partner
   * GET /api/v1/partner-portal/contracts/stats
   */
  async getContractStats(req, res) {
    try {
      const partner_id = req.partner?.partnerId;

      const stats = await this.contractLogModel.aggregate([
        { $match: { partner_id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            latest_signed: { $max: '$signed_at' },
            earliest_expiry: { $min: '$contract_expiry' }
          }
        }
      ]);

      const totalContracts = stats.reduce((sum, stat) => sum + stat.count, 0);

      res.json({
        success: true,
        statistics: {
          total_contracts: totalContracts,
          by_status: stats.reduce((acc, stat) => {
            acc[stat._id.toLowerCase()] = {
              count: stat.count,
              latest_signed: stat.latest_signed,
              earliest_expiry: stat.earliest_expiry
            };
            return acc;
          }, {}),
          generated_at: new Date()
        }
      });

    } catch (error) {
      console.error('Get contract stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new ContractController();
