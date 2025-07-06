import mongoose from 'mongoose';
import { getPartnerDb } from '../config/partnerDb.js';

// Global model reference
let ContractLog = null;

const contractLogSchema = new mongoose.Schema({
  consent_id: {
    type: String,
    required: [true, 'Consent ID is required'],
    unique: true,
    index: true
  },
  user_id: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  contract_purpose: {
    type: String,
    required: [true, 'Contract purpose is required'],
    trim: true
  },
  signed_at: {
    type: Date,
    required: [true, 'Signed date is required'],
    default: Date.now
  },
  contract_expiry: {
    type: Date,
    required: [true, 'Contract expiry is required'],
    index: true
  },
  partner_id: {
    type: String,
    required: [true, 'Partner ID is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
    default: 'ACTIVE',
    index: true
  },
  allowed_data_fields: {
    type: [String],
    required: [true, 'Allowed data fields are required']
  },
  retention_period_days: {
    type: Number,
    required: [true, 'Retention period is required']
  },
  webhook_received_at: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Map,
    of: String,
    default: new Map()
  }
}, {
  timestamps: true,
  collection: 'contractlogs'
});

// Indexes for performance
contractLogSchema.index({ partner_id: 1, status: 1 });
contractLogSchema.index({ contract_expiry: 1, status: 1 });
contractLogSchema.index({ user_id: 1, partner_id: 1 });

// Virtual to check if contract is expired
contractLogSchema.virtual('isExpired').get(function() {
  return this.contract_expiry < new Date();
});

// Method to update status based on expiry
contractLogSchema.methods.updateStatus = function() {
  if (this.isExpired && this.status === 'ACTIVE') {
    this.status = 'EXPIRED';
  }
  return this;
};

// Static method to find active contracts
contractLogSchema.statics.findActiveContracts = function(partnerId) {
  return this.find({
    partner_id: partnerId,
    status: 'ACTIVE',
    contract_expiry: { $gt: new Date() }
  });
};

// Static method to find expired contracts
contractLogSchema.statics.findExpiredContracts = function() {
  return this.find({
    status: 'ACTIVE',
    contract_expiry: { $lte: new Date() }
  });
};

// Pre-save hook to auto-update status
contractLogSchema.pre('save', function(next) {
  this.updateStatus();
  next();
});

const getContractLogModel = () => {
  if (!ContractLog) {
    const partnerDb = getPartnerDb();
    ContractLog = partnerDb.model('ContractLog', contractLogSchema);
  }
  return ContractLog;
};

export default getContractLogModel;
export { getContractLogModel };
