import jwt from 'jsonwebtoken';
import { getSharedDb } from '../config/partnerDb.js';

// Middleware for partner portal authentication
export const partnerPortalAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No token provided or invalid format'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.PARTNER_PORTAL_SECRET);
    
    if (!decoded.partnerId || decoded.type !== 'partner_portal') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token is not for partner portal access'
      });
    }

    // Verify partner exists and is approved in PRIMARY database
    const sharedDb = getSharedDb();
    const partnerSchema = new sharedDb.Schema({}, { strict: false });
    const PartnerModel = sharedDb.model('Partner', partnerSchema, 'partners');
    
    const partner = await PartnerModel.findOne({
      partnerId: decoded.partnerId,
      status: 'approved'
    }).lean();

    if (!partner) {
      return res.status(401).json({
        success: false,
        error: 'Partner not found',
        message: 'Partner is not approved or does not exist'
      });
    }

    // Check token expiration
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please request a new access token'
      });
    }

    // Add partner info to request object
    req.partner = {
      partnerId: partner.partnerId,
      name: partner.name,
      email: partner.email,
      publicKey: partner.publicKey,
      tokenExp: decoded.exp
    };

    // Add client IP for audit logging
    req.ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
             (req.connection.socket ? req.connection.socket.remoteAddress : null);

    next();

  } catch (error) {
    console.error('Partner portal auth error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Please request a new access token'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'Internal authentication error'
    });
  }
};

// Middleware for generating partner portal tokens (used by main backend)
export const generatePartnerPortalToken = (partnerId, expiresIn = '24h') => {
  return jwt.sign(
    {
      partnerId,
      type: 'partner_portal',
      iat: Math.floor(Date.now() / 1000),
      scope: ['data:read', 'contracts:read', 'audit:read']
    },
    process.env.PARTNER_PORTAL_SECRET,
    { expiresIn }
  );
};

// Middleware for API key authentication (for webhook endpoints)
export const apiKeyAuth = (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'X-API-Key header is required'
      });
    }

    // In production, this should be compared against a secure hash
    const validApiKey = process.env.PARTNER_PORTAL_API_KEY || 'partner-portal-webhook-key';
    
    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    next();

  } catch (error) {
    console.error('API key auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

// Rate limiting middleware specifically for partner portal
export const partnerPortalRateLimit = (windowMs = 15 * 60 * 1000, maxRequests = 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const partnerId = req.partner?.partnerId;
    
    if (!partnerId) {
      return next(); // Skip if no partner (will be caught by auth middleware)
    }

    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old requests
    const partnerRequests = requests.get(partnerId) || [];
    const validRequests = partnerRequests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Maximum ${maxRequests} requests per ${windowMs / 60000} minutes`,
        retry_after: Math.ceil((validRequests[0] - windowStart) / 1000)
      });
    }

    // Add current request
    validRequests.push(now);
    requests.set(partnerId, validRequests);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - validRequests.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  };
};

module.exports = {
  partnerPortalAuth,
  generatePartnerPortalToken,
  apiKeyAuth,
  partnerPortalRateLimit
};
