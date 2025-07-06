import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';

class AuditController {
  constructor() {
    this.auditModel = getPartnerAuditLogModel();
  }

  /**
   * Get audit logs for a partner
   * GET /api/v1/partner-portal/audit
   */
  async getAuditLogs(req, res) {
    try {
      const partner_id = req.partner?.partnerId;
      const {
        event_type,
        status,
        consent_id,
        start_date,
        end_date,
        page = 1,
        limit = 100,
        sort = '-timestamp'
      } = req.query;

      // Build query options
      const options = {
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
        eventType: event_type,
        status: status?.toUpperCase(),
        limit: Math.min(parseInt(limit), 500) // Max 500 records per request
      };

      // Add consent_id filter if provided
      let query = { partner_id };
      
      if (consent_id) {
        query.consent_id = consent_id;
      }

      if (options.eventType) {
        query.event_type = options.eventType.toUpperCase();
      }

      if (options.status) {
        query.status = options.status;
      }

      if (options.startDate || options.endDate) {
        query.timestamp = {};
        if (options.startDate) query.timestamp.$gte = options.startDate;
        if (options.endDate) query.timestamp.$lte = options.endDate;
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * options.limit;
      
      const [auditLogs, total] = await Promise.all([
        this.auditModel.find(query)
          .sort(sort)
          .skip(skip)
          .limit(options.limit)
          .select('-additional_data -error_details'), // Exclude sensitive fields from default response
        this.auditModel.countDocuments(query)
      ]);

      res.json({
        success: true,
        audit_logs: auditLogs.map(log => ({
          id: log._id,
          event_type: log.event_type,
          consent_id: log.consent_id,
          timestamp: log.timestamp,
          status: log.status,
          message: log.message,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          request_id: log.request_id,
          response_time_ms: log.response_time_ms,
          data_size_bytes: log.data_size_bytes,
          api_endpoint: log.api_endpoint,
          http_method: log.http_method,
          error_code: log.error_code
        })),
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / options.limit),
          total_records: total,
          has_next: parseInt(page) * options.limit < total,
          has_prev: parseInt(page) > 1
        },
        filters_applied: {
          partner_id,
          event_type,
          status,
          consent_id,
          start_date,
          end_date
        }
      });

    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve audit logs'
      });
    }
  }

  /**
   * Get detailed audit log entry
   * GET /api/v1/partner-portal/audit/:audit_id
   */
  async getAuditLogDetail(req, res) {
    try {
      const { audit_id } = req.params;
      const partner_id = req.partner?.partnerId;

      const auditLog = await this.auditModel.findOne({
        _id: audit_id,
        partner_id
      });

      if (!auditLog) {
        return res.status(404).json({
          success: false,
          error: 'Audit log not found'
        });
      }

      // Verify audit integrity
      const isValid = await this.auditModel.verifyIntegrity(audit_id);

      res.json({
        success: true,
        audit_log: {
          id: auditLog._id,
          event_type: auditLog.event_type,
          consent_id: auditLog.consent_id,
          partner_id: auditLog.partner_id,
          timestamp: auditLog.timestamp,
          status: auditLog.status,
          message: auditLog.message,
          ip_address: auditLog.ip_address,
          user_agent: auditLog.user_agent,
          request_id: auditLog.request_id,
          response_time_ms: auditLog.response_time_ms,
          data_size_bytes: auditLog.data_size_bytes,
          error_code: auditLog.error_code,
          error_details: auditLog.error_details,
          additional_data: Object.fromEntries(auditLog.additional_data || new Map()),
          session_id: auditLog.session_id,
          api_endpoint: auditLog.api_endpoint,
          http_method: auditLog.http_method,
          hash: auditLog.hash,
          integrity_verified: isValid
        }
      });

    } catch (error) {
      console.error('Get audit log detail error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get audit statistics for partner
   * GET /api/v1/partner-portal/audit/stats
   */
  async getAuditStats(req, res) {
    try {
      const partner_id = req.partner?.partnerId;
      const { days = 30 } = req.query;

      const stats = await this.auditModel.getAuditStats(partner_id, parseInt(days));

      // Calculate additional statistics
      const totalEvents = stats.reduce((sum, stat) => sum + stat.count, 0);
      const successRate = stats.reduce((acc, stat) => {
        if (stat._id.status === 'SUCCESS') {
          return acc + stat.count;
        }
        return acc;
      }, 0) / totalEvents * 100;

      const avgResponseTime = stats.reduce((acc, stat) => {
        return acc + (stat.avgResponseTime || 0) * stat.count;
      }, 0) / totalEvents;

      // Group by event type and status
      const eventTypeCounts = {};
      const statusCounts = {};

      stats.forEach(stat => {
        const eventType = stat._id.event_type;
        const status = stat._id.status;

        if (!eventTypeCounts[eventType]) {
          eventTypeCounts[eventType] = 0;
        }
        eventTypeCounts[eventType] += stat.count;

        if (!statusCounts[status]) {
          statusCounts[status] = 0;
        }
        statusCounts[status] += stat.count;
      });

      res.json({
        success: true,
        statistics: {
          partner_id,
          period_days: parseInt(days),
          total_events: totalEvents,
          success_rate_percent: Math.round(successRate * 100) / 100,
          avg_response_time_ms: Math.round(avgResponseTime * 100) / 100,
          by_event_type: eventTypeCounts,
          by_status: statusCounts,
          detailed_breakdown: stats.map(stat => ({
            event_type: stat._id.event_type,
            status: stat._id.status,
            count: stat.count,
            avg_response_time_ms: Math.round((stat.avgResponseTime || 0) * 100) / 100,
            total_data_size_bytes: stat.totalDataSize || 0
          })),
          generated_at: new Date()
        }
      });

    } catch (error) {
      console.error('Get audit stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get audit logs by consent ID
   * GET /api/v1/partner-portal/audit/consent/:consent_id
   */
  async getAuditLogsByConsent(req, res) {
    try {
      const { consent_id } = req.params;
      const partner_id = req.partner?.partnerId;
      const { page = 1, limit = 50, sort = '-timestamp' } = req.query;

      const query = {
        consent_id,
        partner_id
      };

      const options = {
        limit: Math.min(parseInt(limit), 200),
        skip: (parseInt(page) - 1) * parseInt(limit),
        sort: sort
      };

      const [auditLogs, total] = await Promise.all([
        this.auditModel.find(query, null, options),
        this.auditModel.countDocuments(query)
      ]);

      res.json({
        success: true,
        consent_id,
        audit_logs: auditLogs.map(log => ({
          id: log._id,
          event_type: log.event_type,
          timestamp: log.timestamp,
          status: log.status,
          message: log.message,
          response_time_ms: log.response_time_ms,
          ip_address: log.ip_address,
          request_id: log.request_id
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
      console.error('Get audit logs by consent error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Export audit logs (CSV format)
   * GET /api/v1/partner-portal/audit/export
   */
  async exportAuditLogs(req, res) {
    try {
      const partner_id = req.partner?.partnerId;
      const {
        start_date,
        end_date,
        event_type,
        status,
        format = 'csv'
      } = req.query;

      if (format !== 'csv') {
        return res.status(400).json({
          success: false,
          error: 'Only CSV format is supported'
        });
      }

      // Build query
      const query = { partner_id };
      
      if (event_type) query.event_type = event_type.toUpperCase();
      if (status) query.status = status.toUpperCase();
      
      if (start_date || end_date) {
        query.timestamp = {};
        if (start_date) query.timestamp.$gte = new Date(start_date);
        if (end_date) query.timestamp.$lte = new Date(end_date);
      }

      // Limit export to 10,000 records for performance
      const auditLogs = await this.auditModel.find(query)
        .sort({ timestamp: -1 })
        .limit(10000)
        .select('event_type consent_id timestamp status message response_time_ms ip_address');

      // Generate CSV content
      const csvHeader = 'Event Type,Consent ID,Timestamp,Status,Message,Response Time (ms),IP Address\n';
      const csvRows = auditLogs.map(log => {
        const escapedMessage = (log.message || '').replace(/"/g, '""');
        return `"${log.event_type}","${log.consent_id}","${log.timestamp.toISOString()}","${log.status}","${escapedMessage}","${log.response_time_ms || ''}","${log.ip_address || ''}"`;
      }).join('\n');

      const csvContent = csvHeader + csvRows;

      // Set response headers for file download
      const filename = `audit_logs_${partner_id}_${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csvContent));

      res.send(csvContent);

    } catch (error) {
      console.error('Export audit logs error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to export audit logs'
      });
    }
  }

  /**
   * Verify audit log integrity
   * POST /api/v1/partner-portal/audit/verify
   */
  async verifyAuditIntegrity(req, res) {
    try {
      const { audit_ids } = req.body;
      const partner_id = req.partner?.partnerId;

      if (!Array.isArray(audit_ids) || audit_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'audit_ids array is required'
        });
      }

      if (audit_ids.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 audit IDs can be verified at once'
        });
      }

      const verificationResults = [];

      for (const auditId of audit_ids) {
        try {
          // Verify the audit log belongs to the partner
          const auditLog = await this.auditModel.findOne({
            _id: auditId,
            partner_id
          });

          if (!auditLog) {
            verificationResults.push({
              audit_id: auditId,
              verified: false,
              error: 'Audit log not found'
            });
            continue;
          }

          const isValid = await this.auditModel.verifyIntegrity(auditId);
          
          verificationResults.push({
            audit_id: auditId,
            verified: isValid,
            timestamp: auditLog.timestamp,
            event_type: auditLog.event_type
          });

        } catch (error) {
          verificationResults.push({
            audit_id: auditId,
            verified: false,
            error: error.message
          });
        }
      }

      const totalVerified = verificationResults.filter(r => r.verified).length;
      const totalFailed = verificationResults.length - totalVerified;

      res.json({
        success: true,
        verification_summary: {
          total_checked: verificationResults.length,
          verified: totalVerified,
          failed: totalFailed,
          integrity_rate_percent: Math.round((totalVerified / verificationResults.length) * 10000) / 100
        },
        results: verificationResults
      });

    } catch (error) {
      console.error('Verify audit integrity error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new AuditController();
