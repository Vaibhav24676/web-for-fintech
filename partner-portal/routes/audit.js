import express from 'express';
import AuditController from '../controllers/AuditController.js';
import { partnerPortalAuth } from '../middleware/partnerPortalAuth.js';

const router = express.Router();

// All routes require partner authentication
router.use(partnerPortalAuth);

// Get audit statistics
router.get('/stats', AuditController.getAuditStats);

// Export audit logs
router.get('/export', AuditController.exportAuditLogs);

// Verify audit log integrity
router.post('/verify', AuditController.verifyAuditIntegrity);

// Get audit logs by consent ID
router.get('/consent/:consent_id', AuditController.getAuditLogsByConsent);

// Get detailed audit log entry
router.get('/:audit_id', AuditController.getAuditLogDetail);

// Get audit logs for partner
router.get('/', AuditController.getAuditLogs);

export default router;
