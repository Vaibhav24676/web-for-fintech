import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { partnerProtect } from '../middleware/partnerProtect.js'; // ✅ You already have this!

import {
  registerPartner,
  getPartner,
  updatePartner,
  getAllPartners,
  updatePartnerKey,
  partnerDataRequest,
  getPartnerConsents
} from '../controllers/partnerController.js';

const router = express.Router();

/**
 * Admin-only endpoints (protected with JWT-based protect middleware)
 * These require login with username/password and receive JWT.
 */
router.use(['/','/register', '/:partnerId', '/:partnerId/keys'], protect);

// Admin routes
router.route('/')
  .get(restrictTo('admin'), getAllPartners);

router.post('/register', registerPartner);

router.route('/:partnerId')
  .get(getPartner)
  .put(updatePartner);

router.post('/:partnerId/keys', updatePartnerKey);

/**
 * Partner endpoints (protected with your custom partnerProtect middleware)
 * These are for partners sending partnerId + API token, no JWT.
 */
router.post('/data-request', partnerProtect, partnerDataRequest);
router.get('/consents', partnerProtect, getPartnerConsents);

export default router;
