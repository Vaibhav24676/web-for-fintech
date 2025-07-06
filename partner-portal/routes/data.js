import express from 'express';
import DataController from '../controllers/DataController.js';
import { partnerPortalAuth } from '../middleware/partnerPortalAuth.js';

const router = express.Router();

// All routes require partner authentication
router.use(partnerPortalAuth);

// Get data statistics
router.get('/stats', DataController.getDataStats);

// Request user data from bank
router.post('/request', DataController.requestData);

// List all data for partner
router.get('/', DataController.listData);

// Get data status for a specific consent
router.get('/:consent_id/status', DataController.getDataStatus);

// Get decrypted user data
router.get('/:consent_id', DataController.getData);

export default router;
