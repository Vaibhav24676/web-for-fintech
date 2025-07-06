import mongoose from 'mongoose';
import { getPartnerDb } from '../config/partnerDb.js';

// Global model reference
let UserData = null;

const userDataSchema = new mongoose.Schema({
  consent_id: {
    type: String,
    required: [true, 'Consent ID is required'],
    index: true
  },
  partner_id: {
    type: String,
    required: [true, 'Partner ID is required'],
    index: true
  },
  encrypted_data: {
    type: String,
    required: [true, 'Encrypted data is required']
  },
  data_hash: {
    type: String,
    required: [true, 'Data hash is required'],
    validate: {
      validator: function(v) {
        return /^[a-f0-9]{64}$/i.test(v); // SHA-256 hash format
      },
      message: 'Invalid SHA-256 hash format'
    }
  },
  received_at: {
    type: Date,
    required: [true, 'Received date is required'],
    default: Date.now
  },
  expires_at: {
    type: Date,
    required: [true, 'Expiry date is required'],
    index: true
  },
  data_fields: {
    type: [String],
    required: [true, 'Data fields are required'],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one data field must be specified'
    }
  },
  bank_signature: {
    type: String,
    required: [true, 'Bank signature is required']
  },
  data_size_bytes: {
    type: Number,
    default: 0
  },
  encryption_algorithm: {
    type: String,
    default: 'RSA-OAEP-256'
  },
  last_accessed_at: {
    type: Date,
    default: null
  },
  access_count: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'DELETED'],
    default: 'ACTIVE',
    index: true
  },
  bank_request_id: {
    type: String,
    required: [true, 'Bank request ID is required']
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  collection: 'userdata'
});

// Compound indexes for performance
userDataSchema.index({ consent_id: 1, partner_id: 1 }, { unique: true });
userDataSchema.index({ partner_id: 1, status: 1 });
userDataSchema.index({ expires_at: 1, status: 1 });
userDataSchema.index({ received_at: -1 });

// Virtual to check if data is expired
userDataSchema.virtual('isExpired').get(function() {
  return this.expires_at < new Date();
});

// Virtual to get data age in hours
userDataSchema.virtual('ageInHours').get(function() {
  return Math.floor((new Date() - this.received_at) / (1000 * 60 * 60));
});

// Method to update access tracking
userDataSchema.methods.recordAccess = async function() {
  this.last_accessed_at = new Date();
  this.access_count += 1;
  return await this.save();
};

// Method to mark as expired
userDataSchema.methods.markExpired = async function() {
  this.status = 'EXPIRED';
  return await this.save();
};

// Static method to find expired data
userDataSchema.statics.findExpiredData = function() {
  return this.find({
    status: 'ACTIVE',
    expires_at: { $lte: new Date() }
  });
};

// Static method to find data by consent and partner
userDataSchema.statics.findByConsentAndPartner = function(consentId, partnerId) {
  return this.findOne({
    consent_id: consentId,
    partner_id: partnerId,
    status: 'ACTIVE',
    expires_at: { $gt: new Date() }
  });
};

// Static method to get partner data statistics
userDataSchema.statics.getPartnerStats = function(partnerId) {
  return this.aggregate([
    { $match: { partner_id: partnerId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalSize: { $sum: '$data_size_bytes' },
        avgAccessCount: { $avg: '$access_count' }
      }
    }
  ]);
};

// Pre-save hook to calculate data size
userDataSchema.pre('save', function(next) {
  if (this.isModified('encrypted_data')) {
    this.data_size_bytes = Buffer.byteLength(this.encrypted_data, 'utf8');
  }
  
  // Auto-update status if expired
  if (this.isExpired && this.status === 'ACTIVE') {
    this.status = 'EXPIRED';
  }
  
  next();
});

// TTL index for automatic cleanup of expired data (optional failsafe)
userDataSchema.index({ expires_at: 1 }, { 
  expireAfterSeconds: 86400 // 24 hours after expiry as failsafe
});

const getUserDataModel = () => {
  if (!UserData) {
    const partnerDb = getPartnerDb();
    UserData = partnerDb.model('UserData', userDataSchema);
  }
  return UserData;
};

export default getUserDataModel;
export { getUserDataModel };
