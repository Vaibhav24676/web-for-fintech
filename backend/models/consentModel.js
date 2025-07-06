import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Partner from './partnerModel.js';
import { logWarn, logError } from '../utils/loggerService.js';

const consentSchema = new mongoose.Schema({
  consentId: { 
    type: String, 
    default: () => uuidv4(),
    unique: true
  },
  customerId: { 
    type: String, 
    ref: 'Customer',
    required: [true, 'Customer ID is required']
  },
  partnerId: { 
    type: String, 
    ref: 'Partner',
    required: [true, 'Partner ID is required'] 
  },
  consentVersion: { 
    type: String, 
    default: 'v1.0' 
  },
  allowedDataFields: {
    type: [String],
    required: [true, 'At least one data field must be specified']
  },
  purpose: {
    type: String,
    required: [true, 'Purpose is required']
  },
  retentionPeriod: {
    type: Number, // in days
    required: [true, 'Retention period is required']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: {
    type: Date,
    required: [true, 'Expiry date is required'],
    index: false // Disable default index creation
  },
  consentDuration: {
    type: Number, // in milliseconds
    required: [true, 'Consent duration is required'],
    validate: {
      validator: function(value) {
        return value >= parseInt(process.env.MIN_CONSENT_DURATION_MS);
      },
      message: props => `Consent duration must be at least ${parseInt(process.env.MIN_CONSENT_DURATION_MS) / (60 * 60 * 1000)} hour(s)`
    }
  },
  status: { 
    type: String, 
    default: 'active',
    enum: ['active', 'revoked', 'expired', 'pending']
  },
  consentMethod: String,
  ipAddressHash: String,
  deviceFingerprint: String,
  legalBasis: String,
  withdrawalMethod: String,
  contractText: {
    type: String,
    required: [true, 'Contract text is required']
  },
  contractId: {
    type: String,
    required: [true, 'Contract ID is required']
  }
});

// Update the updatedAt timestamp before saving
consentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add partner validation with graceful degradation
consentSchema.pre('save', async function(next) {
  // Skip validation if this is an update (not a new consent)
  if (!this.isNew) {
    return next();
  }
  
  try {
    // Attempt to find the partner in the local database
    const partner = await Partner.findOne({ partnerId: this.partnerId });
    
    if (!partner) {
      // Log warning but allow operation to continue
      logWarn('Partner not found in local database', { 
        partnerId: this.partnerId,
        consentId: this.consentId
      });
      
      // Set a warning status if configured to do so
      if (process.env.STRICT_PARTNER_VALIDATION !== 'true') {
        // Continue with consent creation but mark as pending
        this.status = 'pending';
        return next();
      } else {
        // Strict validation mode - reject the consent
        return next(new Error(`Partner ID ${this.partnerId} not found in database`));
      }
    }
    
    // Partner exists, continue normally
    return next();
  } catch (error) {
    logError('Error validating partner for consent', {
      partnerId: this.partnerId,
      consentId: this.consentId,
      error: error.message
    });
    
    if (process.env.STRICT_PARTNER_VALIDATION !== 'true') {
      // Continue with consent creation but mark as pending
      this.status = 'pending';
      return next();
    } else {
      return next(error);
    }
  }
});

// Create indexes for performance
consentSchema.index({ customerId: 1 });
consentSchema.index({ partnerId: 1 });
consentSchema.index({ status: 1 });

// For the expiresAt field, we'll use a single approach without explicit index declaration
// This prevents duplicate indexes since Mongoose may be auto-creating one internally

const Consent = mongoose.model('Consent', consentSchema);

export default Consent;
