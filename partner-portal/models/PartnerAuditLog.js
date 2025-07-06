import mongoose from 'mongoose';
import crypto from 'crypto';
import { getPartnerDb } from '../config/partnerDb.js';

// Global model reference
let PartnerAuditLog = null;

const partnerAuditLogSchema = new mongoose.Schema({
  event_type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: [
      'CONTRACT_RECEIVED',
      'DATA_REQUESTED', 
      'DATA_RECEIVED',
      'AUTO_DELETED',
      'DATA_ACCESS',
      'DATA_EXPIRED',
      'SIGNATURE_VERIFIED',
      'SIGNATURE_FAILED',
      'CONSENT_VALIDATED',
      'CONSENT_INVALID',
      'SYSTEM_ERROR'
    ],
    index: true
  },
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
  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required'],
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['SUCCESS', 'FAILURE', 'PENDING', 'WARNING'],
    index: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  ip_address: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/undefined
        // IPv4 or IPv6 regex validation
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(v) || ipv6Regex.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  user_agent: {
    type: String,
    trim: true
  },
  request_id: {
    type: String,
    index: true
  },
  response_time_ms: {
    type: Number,
    min: 0
  },
  data_size_bytes: {
    type: Number,
    min: 0
  },
  error_code: {
    type: String,
    trim: true
  },
  error_details: {
    type: String,
    trim: true
  },
  additional_data: {
    type: Map,
    of: String,
    default: new Map()
  },
  session_id: {
    type: String,
    trim: true
  },
  api_endpoint: {
    type: String,
    trim: true
  },
  http_method: {
    type: String,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    uppercase: true
  },
  hash: {
    type: String,
    required: [true, 'Hash is required for audit integrity']
  }
}, {
  timestamps: false, // We use our own timestamp field
  collection: 'partnerauditlogs'
});

// Indexes for efficient querying
partnerAuditLogSchema.index({ timestamp: -1 });
partnerAuditLogSchema.index({ partner_id: 1, timestamp: -1 });
partnerAuditLogSchema.index({ event_type: 1, timestamp: -1 });
partnerAuditLogSchema.index({ status: 1, timestamp: -1 });
partnerAuditLogSchema.index({ consent_id: 1, timestamp: -1 });

// Compound indexes for common queries
partnerAuditLogSchema.index({ partner_id: 1, event_type: 1, timestamp: -1 });
partnerAuditLogSchema.index({ consent_id: 1, event_type: 1, timestamp: -1 });

// Virtual for human-readable timestamp
partnerAuditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Method to generate hash for audit integrity
partnerAuditLogSchema.methods.generateHash = function() {
  const data = `${this.event_type}|${this.consent_id}|${this.partner_id}|${this.timestamp.toISOString()}|${this.status}|${this.message}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Static method to create audit log entry
partnerAuditLogSchema.statics.createAuditLog = async function(logData) {
  const auditEntry = new this(logData);
  
  // Generate hash for integrity
  const data = `${auditEntry.event_type}|${auditEntry.consent_id}|${auditEntry.partner_id}|${auditEntry.timestamp.toISOString()}|${auditEntry.status}|${auditEntry.message}`;
  auditEntry.hash = crypto.createHash('sha256').update(data).digest('hex');
  
  return await auditEntry.save();
};

// Static method to get audit logs by partner
partnerAuditLogSchema.statics.getByPartner = function(partnerId, options = {}) {
  const query = { partner_id: partnerId };
  
  if (options.startDate || options.endDate) {
    query.timestamp = {};
    if (options.startDate) query.timestamp.$gte = new Date(options.startDate);
    if (options.endDate) query.timestamp.$lte = new Date(options.endDate);
  }
  
  if (options.eventType) {
    query.event_type = options.eventType;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

// Static method to get audit statistics
partnerAuditLogSchema.statics.getAuditStats = function(partnerId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        partner_id: partnerId,
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          event_type: '$event_type',
          status: '$status'
        },
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$response_time_ms' },
        totalDataSize: { $sum: '$data_size_bytes' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Static method to verify audit integrity
partnerAuditLogSchema.statics.verifyIntegrity = async function(auditId) {
  const audit = await this.findById(auditId);
  
  if (!audit) return false;
  
  const data = `${audit.event_type}|${audit.consent_id}|${audit.partner_id}|${audit.timestamp.toISOString()}|${audit.status}|${audit.message}`;
  const calculatedHash = crypto.createHash('sha256').update(data).digest('hex');
  
  return calculatedHash === audit.hash;
};

// Prevent modification of audit logs (immutable)
partnerAuditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Audit logs are immutable and cannot be modified');
});

partnerAuditLogSchema.pre('updateOne', function() {
  throw new Error('Audit logs are immutable and cannot be modified');
});

partnerAuditLogSchema.pre('updateMany', function() {
  throw new Error('Audit logs are immutable and cannot be modified');
});

const getPartnerAuditLogModel = () => {
  if (!PartnerAuditLog) {
    const partnerDb = getPartnerDb();
    PartnerAuditLog = partnerDb.model('PartnerAuditLog', partnerAuditLogSchema);
  }
  return PartnerAuditLog;
};

export default getPartnerAuditLogModel;
export { getPartnerAuditLogModel };
