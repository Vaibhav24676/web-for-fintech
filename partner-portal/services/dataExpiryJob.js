import cron from 'node-cron';
import { getUserDataModel } from '../models/UserData.js';
import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';

class DataExpiryService {
  constructor() {
    this.isRunning = false;
    this.schedule = '0 0 * * *'; // Daily at midnight
    this.userDataModel = null; // Will be initialized when needed
    this.auditModel = null; // Will be initialized when needed
    this.cronJob = null;
    this.stats = {
      lastRun: null,
      recordsDeleted: 0,
      totalRuns: 0,
      errors: 0
    };
  }

  /**
   * Initialize models when needed (lazy initialization)
   */
  initializeModels() {
    if (!this.userDataModel) {
      this.userDataModel = getUserDataModel();
    }
    if (!this.auditModel) {
      this.auditModel = getPartnerAuditLogModel();
    }
  }

  /**
   * Start the automated data expiry job
   * @param {string} customSchedule - Optional custom cron schedule
   */
  start(customSchedule = null) {
    if (this.isRunning) {
      console.log('⚠️ Data expiry job is already running');
      return;
    }

    try {
      // Initialize models when starting the service
      this.initializeModels();
    } catch (error) {
      console.error('❌ Failed to initialize models for data expiry service:', error.message);
      return;
    }

    const schedule = customSchedule || this.schedule;
    
    this.cronJob = cron.schedule(schedule, async () => {
      await this.runExpiryCleanup();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    this.cronJob.start();
    this.isRunning = true;
    
    console.log(`✅ Data expiry job started with schedule: ${schedule}`);
  }

  /**
   * Stop the automated data expiry job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Data expiry job stopped');
  }

  /**
   * Manually run the expiry cleanup process
   * @returns {Promise<Object>} Cleanup results
   */
  async runExpiryCleanup() {
    const startTime = Date.now();
    let deletedCount = 0;
    const errors = [];

    try {
      console.log('🧹 Starting data expiry cleanup...');

      // Ensure models are initialized
      this.initializeModels();

      // Find all expired data
      const expiredData = await this.userDataModel.findExpiredData();
      
      console.log(`📊 Found ${expiredData.length} expired records`);

      // Process each expired record
      for (const record of expiredData) {
        try {
          await this.deleteExpiredRecord(record);
          deletedCount++;
        } catch (error) {
          errors.push({
            consentId: record.consent_id,
            partnerId: record.partner_id,
            error: error.message
          });
          console.error(`❌ Failed to delete record ${record.consent_id}:`, error.message);
        }
      }

      // Update statistics
      this.stats.lastRun = new Date();
      this.stats.recordsDeleted += deletedCount;
      this.stats.totalRuns++;
      this.stats.errors += errors.length;

      const duration = Date.now() - startTime;

      // Log overall cleanup results
      await this.auditModel.createAuditLog({
        event_type: 'AUTO_DELETED',
        consent_id: 'SYSTEM',
        partner_id: 'SYSTEM',
        status: errors.length === 0 ? 'SUCCESS' : 'WARNING',
        message: `Cleanup completed: ${deletedCount} records deleted, ${errors.length} errors`,
        response_time_ms: duration,
        additional_data: new Map([
          ['deleted_count', deletedCount.toString()],
          ['error_count', errors.length.toString()],
          ['total_found', expiredData.length.toString()]
        ])
      });

      console.log(`✅ Data expiry cleanup completed in ${duration}ms`);
      console.log(`📈 Deleted: ${deletedCount}, Errors: ${errors.length}`);

      return {
        success: true,
        deletedCount,
        errors,
        duration,
        totalFound: expiredData.length
      };

    } catch (error) {
      this.stats.errors++;
      
      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: 'SYSTEM',
        partner_id: 'SYSTEM',
        status: 'FAILURE',
        message: `Data expiry cleanup failed: ${error.message}`,
        error_code: 'CLEANUP_ERROR',
        error_details: error.stack,
        response_time_ms: Date.now() - startTime
      });

      console.error('❌ Data expiry cleanup failed:', error.message);
      throw error;
    }
  }

  /**
   * Delete a single expired record
   * @param {Object} record - The expired UserData record
   */
  async deleteExpiredRecord(record) {
    try {
      // Create audit log before deletion
      await this.auditModel.createAuditLog({
        event_type: 'AUTO_DELETED',
        consent_id: record.consent_id,
        partner_id: record.partner_id,
        status: 'SUCCESS',
        message: `Expired data deleted - expired on ${record.expires_at.toISOString()}`,
        data_size_bytes: record.data_size_bytes,
        additional_data: new Map([
          ['received_at', record.received_at.toISOString()],
          ['access_count', record.access_count.toString()],
          ['data_fields', record.data_fields.join(',')]
        ])
      });

      // Delete the record
      await this.userDataModel.findByIdAndDelete(record._id);

      console.log(`🗑️ Deleted expired data for consent: ${record.consent_id}`);

    } catch (error) {
      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: record.consent_id,
        partner_id: record.partner_id,
        status: 'FAILURE',
        message: `Failed to delete expired data: ${error.message}`,
        error_code: 'DELETE_ERROR',
        error_details: error.stack
      });

      throw error;
    }
  }

  /**
   * Get cleanup statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      schedule: this.schedule
    };
  }

  /**
   * Find data expiring within specified days
   * @param {number} days - Number of days to look ahead
   * @returns {Promise<Array>} Records expiring soon
   */
  async findDataExpiringSoon(days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.userDataModel.find({
      status: 'ACTIVE',
      expires_at: {
        $gte: new Date(),
        $lte: futureDate
      }
    }).select('consent_id partner_id expires_at data_fields');
  }

  /**
   * Get expiry summary for a specific partner
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Partner expiry summary
   */
  async getPartnerExpirySummary(partnerId) {
    const now = new Date();
    
    const [active, expired, expiringSoon] = await Promise.all([
      this.userDataModel.countDocuments({
        partner_id: partnerId,
        status: 'ACTIVE',
        expires_at: { $gt: now }
      }),
      this.userDataModel.countDocuments({
        partner_id: partnerId,
        status: 'ACTIVE',
        expires_at: { $lte: now }
      }),
      this.userDataModel.countDocuments({
        partner_id: partnerId,
        status: 'ACTIVE',
        expires_at: {
          $gt: now,
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      })
    ]);

    return {
      partnerId,
      active,
      expired,
      expiringSoon,
      lastChecked: now
    };
  }

  /**
   * Force cleanup for a specific partner
   * @param {string} partnerId - Partner ID
   * @returns {Promise<Object>} Cleanup results
   */
  async forceCleanupPartner(partnerId) {
    const startTime = Date.now();
    
    const expiredData = await this.userDataModel.find({
      partner_id: partnerId,
      status: 'ACTIVE',
      expires_at: { $lte: new Date() }
    });

    let deletedCount = 0;
    const errors = [];

    for (const record of expiredData) {
      try {
        await this.deleteExpiredRecord(record);
        deletedCount++;
      } catch (error) {
        errors.push({
          consentId: record.consent_id,
          error: error.message
        });
      }
    }

    return {
      partnerId,
      deletedCount,
      errors,
      duration: Date.now() - startTime
    };
  }
}

// Singleton instance
const dataExpiryService = new DataExpiryService();

export default dataExpiryService;
export { DataExpiryService };
