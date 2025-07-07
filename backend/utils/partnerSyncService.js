/**
 * Partner Data Synchronization Service
 * 
 * This service synchronizes critical partner data between the main database and partner portal database.
 * It ensures that the main API can continue to function even when the Partner Portal is unavailable.
 */

import mongoose from 'mongoose';
import Partner from '../models/partnerModel.js';
import { getPartnerDb, getSharedDb } from '../../partner-portal/config/partnerDb.js';
import { logInfo, logError, logWarn } from '../utils/loggerService.js';

class PartnerSyncService {
  constructor() {
    this.isPartnerPortalAvailable = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
  }

  /**
   * Initialize the sync service
   * @param {number} syncIntervalMs - Milliseconds between sync operations
   */
  initialize(syncIntervalMs = 3600000) { // Default: 1 hour
    logInfo('Initializing Partner Sync Service');
    
    // Try to determine if Partner Portal is available
    this.checkPartnerPortalAvailability();
    
    // Set up periodic sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      this.syncPartnerData().catch(error => {
        logError('Partner data sync failed', { error: error.message });
      });
    }, syncIntervalMs);
    
    logInfo('Partner Sync Service initialized', { 
      syncIntervalMs, 
      isPartnerPortalAvailable: this.isPartnerPortalAvailable 
    });
  }

  /**
   * Check if Partner Portal database is available
   */
  async checkPartnerPortalAvailability() {
    try {
      const partnerDb = getPartnerDb();
      this.isPartnerPortalAvailable = !!partnerDb;
      return true;
    } catch (error) {
      this.isPartnerPortalAvailable = false;
      return false;
    }
  }

  /**
   * Synchronize partner data between databases
   */
  async syncPartnerData() {
    // First check if Partner Portal is available
    const isAvailable = await this.checkPartnerPortalAvailability();
    
    if (!isAvailable) {
      logWarn('Partner Portal unavailable, skipping sync');
      return false;
    }
    
    try {
      logInfo('Starting partner data synchronization');
      
      // Get partner database connection
      const partnerDb = getPartnerDb();
      const PartnerPortalContract = partnerDb.model('ContractLog', new mongoose.Schema({
        partner_id: String,
        consent_id: String,
        status: String,
        signed_at: Date,
        expires_at: Date,
        allowed_data_fields: [String],
        contract_purpose: String,
        retention_period_days: Number,
        metadata: Map
      }, { collection: 'contractlogs' }));
      
      // Get active partners from Partner Portal
      const activeContracts = await PartnerPortalContract.find({ status: 'ACTIVE' });
      
      logInfo(`Found ${activeContracts.length} active contracts in Partner Portal`);
      
      // Sync to main database
      for (const contract of activeContracts) {
        try {
          // Check if partner exists in main DB
          const existingPartner = await Partner.findOne({ partnerId: contract.partner_id });
          
          if (existingPartner) {
            // Update existing partner with contract data
            existingPartner.contractData = {
              allowedDataFields: contract.allowed_data_fields,
              purpose: contract.contract_purpose,
              retentionPeriod: contract.retention_period_days,
              contractId: contract.consent_id,
              version: existingPartner.contractData?.version || 1
            };
            existingPartner.approvedContract = true;
            existingPartner.contractApprovedAt = contract.signed_at;
            
            await existingPartner.save();
            logInfo(`Updated partner ${existingPartner.partnerId} with latest contract data`);
          } else {
            // Create a new partner record from contract data
            const newPartner = new Partner({
              partnerId: contract.partner_id,
              partnerName: contract.metadata.get('partner_name') || 'Unknown Partner',
              status: 'active',
              approvedContract: true,
              contractApprovedAt: contract.signed_at,
              contractData: {
                allowedDataFields: contract.allowed_data_fields,
                purpose: contract.contract_purpose,
                retentionPeriod: contract.retention_period_days,
                contractId: contract.consent_id,
                version: 1
              }
            });
            
            await newPartner.save();
            logInfo(`Created new partner ${newPartner.partnerId} from contract data`);
          }
        } catch (partnerError) {
          logError(`Error syncing partner ${contract.partner_id}`, { 
            error: partnerError.message, 
            contractId: contract.consent_id 
          });
        }
      }
      
      this.lastSyncTime = new Date();
      logInfo('Partner data synchronization completed', { lastSyncTime: this.lastSyncTime });
      return true;
    } catch (error) {
      logError('Partner data synchronization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Force an immediate data sync
   */
  async forceSyncNow() {
    return await this.syncPartnerData();
  }

  /**
   * Get sync status information
   */
  getStatus() {
    return {
      isPartnerPortalAvailable: this.isPartnerPortalAvailable,
      lastSyncTime: this.lastSyncTime,
      syncActive: !!this.syncInterval
    };
  }

  /**
   * Shutdown the sync service
   */
  shutdown() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logInfo('Partner Sync Service shut down');
  }
}

// Create a singleton instance
const partnerSyncService = new PartnerSyncService();

export default partnerSyncService;
