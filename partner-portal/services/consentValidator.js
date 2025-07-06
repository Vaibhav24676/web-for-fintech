import { getSharedDb } from '../config/partnerDb.js';
import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';

// Service to validate consent against the PRIMARY database (read-only)
class ConsentValidator {
  constructor() {
    this.sharedDb = null;
    this.consentModel = null;
    this.partnerModel = null;
    this.auditModel = getPartnerAuditLogModel();
  }

  async initialize() {
    if (!this.sharedDb) {
      this.sharedDb = getSharedDb();
      
      // Define schemas for read-only access to existing models
      const consentSchema = new this.sharedDb.Schema({}, { strict: false });
      const partnerSchema = new this.sharedDb.Schema({}, { strict: false });
      
      this.consentModel = this.sharedDb.model('Consent', consentSchema, 'consents');
      this.partnerModel = this.sharedDb.model('Partner', partnerSchema, 'partners');
    }
  }

  /**
   * Validates if a consent exists and is active
   * @param {string} consentId - The consent ID to validate
   * @param {string} partnerId - The partner ID making the request
   * @returns {Promise<Object>} Validation result
   */
  async validateConsent(consentId, partnerId) {
    try {
      await this.initialize();

      const startTime = Date.now();
      
      // Check if consent exists in PRIMARY database
      const consent = await this.consentModel.findOne({ 
        consentId: consentId,
        partnerId: partnerId 
      }).lean();

      if (!consent) {
        await this.auditModel.createAuditLog({
          event_type: 'CONSENT_INVALID',
          consent_id: consentId,
          partner_id: partnerId,
          status: 'FAILURE',
          message: 'Consent not found in primary database',
          response_time_ms: Date.now() - startTime
        });

        return {
          isValid: false,
          reason: 'CONSENT_NOT_FOUND',
          message: 'Consent does not exist'
        };
      }

      // Check if consent is still active (not expired or revoked)
      const now = new Date();
      const isExpired = new Date(consent.expiresAt) <= now;
      const isRevoked = consent.status === 'revoked';

      if (isExpired) {
        await this.auditModel.createAuditLog({
          event_type: 'CONSENT_INVALID',
          consent_id: consentId,
          partner_id: partnerId,
          status: 'FAILURE',
          message: 'Consent has expired',
          response_time_ms: Date.now() - startTime
        });

        return {
          isValid: false,
          reason: 'CONSENT_EXPIRED',
          message: 'Consent has expired',
          expiresAt: consent.expiresAt
        };
      }

      if (isRevoked) {
        await this.auditModel.createAuditLog({
          event_type: 'CONSENT_INVALID',
          consent_id: consentId,
          partner_id: partnerId,
          status: 'FAILURE',
          message: 'Consent has been revoked',
          response_time_ms: Date.now() - startTime
        });

        return {
          isValid: false,
          reason: 'CONSENT_REVOKED',
          message: 'Consent has been revoked'
        };
      }

      // Validate partner is approved and active
      const partner = await this.partnerModel.findOne({ 
        partnerId: partnerId,
        status: 'approved'
      }).lean();

      if (!partner) {
        await this.auditModel.createAuditLog({
          event_type: 'CONSENT_INVALID',
          consent_id: consentId,
          partner_id: partnerId,
          status: 'FAILURE',
          message: 'Partner not approved or not found',
          response_time_ms: Date.now() - startTime
        });

        return {
          isValid: false,
          reason: 'PARTNER_NOT_APPROVED',
          message: 'Partner is not approved'
        };
      }

      // Log successful validation
      await this.auditModel.createAuditLog({
        event_type: 'CONSENT_VALIDATED',
        consent_id: consentId,
        partner_id: partnerId,
        status: 'SUCCESS',
        message: 'Consent successfully validated',
        response_time_ms: Date.now() - startTime
      });

      return {
        isValid: true,
        consent: {
          consentId: consent.consentId,
          customerId: consent.customerId,
          partnerId: consent.partnerId,
          allowedDataFields: consent.allowedDataFields,
          purpose: consent.purpose,
          retentionPeriod: consent.retentionPeriod,
          expiresAt: consent.expiresAt,
          createdAt: consent.createdAt
        },
        partner: {
          partnerId: partner.partnerId,
          name: partner.name,
          publicKey: partner.publicKey
        }
      };

    } catch (error) {
      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: consentId || 'unknown',
        partner_id: partnerId || 'unknown',
        status: 'FAILURE',
        message: `Consent validation error: ${error.message}`,
        error_code: 'VALIDATION_ERROR',
        error_details: error.stack
      });

      throw new Error(`Consent validation failed: ${error.message}`);
    }
  }

  /**
   * Gets consent details without validation (for internal use)
   * @param {string} consentId - The consent ID
   * @returns {Promise<Object>} Consent details
   */
  async getConsentDetails(consentId) {
    try {
      await this.initialize();
      
      const consent = await this.consentModel.findOne({ 
        consentId: consentId 
      }).lean();

      return consent;
    } catch (error) {
      throw new Error(`Failed to get consent details: ${error.message}`);
    }
  }

  /**
   * Validates specific data fields against consent
   * @param {string} consentId - The consent ID
   * @param {Array<string>} requestedFields - Fields being requested
   * @returns {Promise<Object>} Field validation result
   */
  async validateDataFields(consentId, requestedFields) {
    try {
      const consent = await this.getConsentDetails(consentId);
      
      if (!consent) {
        return {
          isValid: false,
          reason: 'CONSENT_NOT_FOUND'
        };
      }

      const allowedFields = consent.allowedDataFields || [];
      const unauthorizedFields = requestedFields.filter(
        field => !allowedFields.includes(field)
      );

      if (unauthorizedFields.length > 0) {
        return {
          isValid: false,
          reason: 'UNAUTHORIZED_FIELDS',
          unauthorizedFields,
          allowedFields
        };
      }

      return {
        isValid: true,
        allowedFields: requestedFields
      };

    } catch (error) {
      throw new Error(`Field validation failed: ${error.message}`);
    }
  }

  /**
   * Batch validate multiple consents
   * @param {Array<Object>} requests - Array of {consentId, partnerId}
   * @returns {Promise<Array>} Array of validation results
   */
  async batchValidateConsents(requests) {
    const results = [];
    
    for (const request of requests) {
      try {
        const result = await this.validateConsent(request.consentId, request.partnerId);
        results.push({
          consentId: request.consentId,
          partnerId: request.partnerId,
          ...result
        });
      } catch (error) {
        results.push({
          consentId: request.consentId,
          partnerId: request.partnerId,
          isValid: false,
          reason: 'VALIDATION_ERROR',
          message: error.message
        });
      }
    }
    
    return results;
  }
}

// Singleton instance
const consentValidator = new ConsentValidator();

export default consentValidator;
export { ConsentValidator };
