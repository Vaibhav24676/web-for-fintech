import express from 'express';
import ContractController from '../controllers/ContractController.js';
import { partnerPortalAuth } from '../middleware/partnerPortalAuth.js';

const router = express.Router();

// Get contract statistics (protected route)
router.get('/stats', partnerPortalAuth, ContractController.getContractStats);

// Webhook endpoint (no auth required - internal system call)
router.post('/webhook/consent-received', ContractController.receiveConsentWebhook);

// Protected routes (require partner authentication)
router.use(partnerPortalAuth);

// Get all contracts for partner
router.get('/', ContractController.getPartnerContracts);

// Get contract by consent ID
router.get('/:consent_id', ContractController.getContract);

// Update contract status
router.patch('/:consent_id', ContractController.updateContract);

export default router;
