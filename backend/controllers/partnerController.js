import Partner from '../models/partnerModel.js';
import Consent from '../models/consentModel.js';
import Customer from '../models/customerModel.js';
import DataRequest from '../models/dataRequestModel.js';
import User from '../models/userModel.js';
import encryptionService from '../utils/encryptionService.js';
import signatureService from '../utils/signatureService.js';
import auditService from '../utils/auditService.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// @desc    Get all partners
// @route   GET /api/v1/partners
// @access  Admin
export const getAllPartners = async (req, res, next) => {
  try {
    const partners = await Partner.find();

    res.status(200).json({
      status: 'success',
      results: partners.length,
      data: {
        partners
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get partner by ID
// @route   GET /api/v1/partners/:partnerId
// @access  Protected
export const getPartner = async (req, res, next) => {
  try {
    const partner = await Partner.findOne({ partnerId: req.params.partnerId });

    if (!partner) {
      return res.status(404).json({
        status: 'error',
        message: 'No partner found with that ID'
      });
    }

    // Check if user has permission to view this partner
    if (
      req.user.role !== 'admin' && 
      !(req.user.role === 'partner' && req.user.partnerId === partner.partnerId)
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to view this partner'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        partner
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register a new partner
// @route   POST /api/v1/partners/register
// @access  Admin
export const registerPartner = async (req, res, next) => {
  try {
    const { partnerName, email, publicKey, callbackUrl } = req.body;

    // Generate a unique partner ID
    const partnerId = `partner-${uuidv4().slice(0, 8)}`;

    // Generate an API token
    const apiToken = crypto.randomBytes(32).toString('hex');
    const apiTokenHash = crypto.createHash('sha256').update(apiToken).digest('hex');

    // Create the partner
    const newPartner = await Partner.create({
      partnerId,
      partnerName,
      publicKey,
      apiTokenHash,
      callbackUrl,
      status: 'pending' // Admin needs to approve
    });

    // Create a user account for the partner
    const newUser = await User.create({
      username: partnerId,
      email,
      password: apiToken, // Initial password is the API token
      role: 'partner',
      partnerId
    });

    // Log partner registration
    await auditService.logEvent({
      eventType: 'partner_registered',
      actorType: req.user.role,
      actorId: req.user._id,
      partnerId: newPartner.partnerId,
      actionDetails: { 
        partnerId: newPartner.partnerId,
        partnerName: newPartner.partnerName
      },
      metadata: { ip: req.ip }
    });

    res.status(201).json({
      status: 'success',
      data: {
        partner: newPartner,
        apiToken // Only show this once
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update partner
// @route   PUT /api/v1/partners/:partnerId
// @access  Protected
export const updatePartner = async (req, res, next) => {
  try {
    const { partnerName, callbackUrl, status, trustScore } = req.body;
    const updateData = {};

    // Only update the fields that were provided
    if (partnerName) updateData.partnerName = partnerName;
    if (callbackUrl) updateData.callbackUrl = callbackUrl;
    
    // Only admin can update these fields
    if (req.user.role === 'admin') {
      if (status) updateData.status = status;
      if (trustScore) updateData.trustScore = trustScore;
    }

    // Set the updated timestamp
    updateData.updatedAt = Date.now();

    const partner = await Partner.findOneAndUpdate(
      { partnerId: req.params.partnerId },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    if (!partner) {
      return res.status(404).json({
        status: 'error',
        message: 'No partner found with that ID'
      });
    }

    // Check if user has permission to update this partner
    if (
      req.user.role !== 'admin' && 
      !(req.user.role === 'partner' && req.user.partnerId === partner.partnerId)
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this partner'
      });
    }

    // Log partner update
    await auditService.logEvent({
      eventType: 'partner_updated',
      actorType: req.user.role,
      actorId: req.user._id,
      partnerId: partner.partnerId,
      actionDetails: { 
        partnerId: partner.partnerId,
        updatedFields: Object.keys(req.body)
      },
      metadata: { ip: req.ip }
    });

    res.status(200).json({
      status: 'success',
      data: {
        partner
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update partner's public key
// @route   POST /api/v1/partners/:partnerId/keys
// @access  Protected
export const updatePartnerKey = async (req, res, next) => {
  try {
    const { publicKey } = req.body;

    if (!publicKey) {
      return res.status(400).json({
        status: 'error',
        message: 'Public key is required'
      });
    }

    const partner = await Partner.findOne({ partnerId: req.params.partnerId });

    if (!partner) {
      return res.status(404).json({
        status: 'error',
        message: 'No partner found with that ID'
      });
    }

    // Check if user has permission to update this partner's key
    if (
      req.user.role !== 'admin' && 
      !(req.user.role === 'partner' && req.user.partnerId === partner.partnerId)
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update this partner key'
      });
    }

    // Update the public key
    partner.publicKey = publicKey;
    partner.updatedAt = Date.now();
    await partner.save();

    // Log key update
    await auditService.logEvent({
      eventType: 'partner_key_updated',
      actorType: req.user.role,
      actorId: req.user._id,
      partnerId: partner.partnerId,
      actionDetails: { 
        partnerId: partner.partnerId
      },
      metadata: { ip: req.ip }
    });

    res.status(200).json({
      status: 'success',
      data: {
        partner
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Partner data request
// @route   POST /api/v1/partner/data-request
// @access  Partner
export const partnerDataRequest = async (req, res, next) => {
  try {
    const { consentId, requestedFields, purpose, requestId = uuidv4() } = req.body;
    const requestSignature = req.headers['x-signature'];
    const partnerId = req.user.partnerId;

    if (!partnerId) {
      return res.status(403).json({
        status: 'error',
        message: 'Only partners can make data requests'
      });
    }

    // Check if consent exists and is active
    const consent = await Consent.findOne({ 
      consentId, 
      partnerId,
      status: 'active'
    });

    if (!consent) {
      return res.status(404).json({
        status: 'error',
        message: 'No active consent found with that ID for this partner'
      });
    }

    // Check if consent has expired
    if (new Date(consent.expiresAt) < new Date()) {
      // Update consent status to expired
      consent.status = 'expired';
      await consent.save();

      return res.status(400).json({
        status: 'error',
        message: 'Consent has expired'
      });
    }

    // Validate requested fields are allowed in the consent
    const invalidFields = requestedFields.filter(
      field => !consent.allowedDataFields.includes(field)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `The following fields are not allowed in the consent: ${invalidFields.join(', ')}`
      });
    }

    // Validate that the purpose matches
    if (purpose !== consent.purpose) {
      return res.status(400).json({
        status: 'error',
        message: 'Purpose does not match consent purpose'
      });
    }

    // Create a data request record
    const dataRequest = await DataRequest.create({
      requestId,
      consentId,
      partnerId,
      requestedFields,
      requestSignature,
      status: 'approved',
      createdAt: Date.now(),
      processedAt: Date.now(),
      // Set expiry for the data (1 hour from now)
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    // Get customer data
    const customer = await Customer.findById(consent.customerId);
    if (!customer) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
      });
    }

    // Prepare the data response
    const responseData = {};
    const encryptedFields = {
      phone: customer.encryptedPhone,
      email: customer.encryptedEmail,
      pan: customer.encryptedPan,
      address: customer.encryptedAddress,
      name: customer.encryptedName
    };

    // Decrypt and include only the requested fields
    for (const field of requestedFields) {
      if (encryptedFields[field] && encryptedFields[field] !== 'null') {
        try {
          const encryptedData = JSON.parse(encryptedFields[field]);
          responseData[field] = await encryptionService.decryptField(encryptedData);
        } catch (error) {
          console.error(`Error decrypting ${field}:`, error);
          responseData[field] = null;
        }
      } else {
        responseData[field] = null;
      }
    }

    // Sign the response
    const responseSignature = signatureService.signData(responseData);
    dataRequest.responseSignature = responseSignature;
    await dataRequest.save();

    // Get partner's public key for encryption
    const partner = await Partner.findOne({ partnerId });
    let finalResponseData = responseData;
    
    if (partner && partner.publicKey) {
      try {
        // Encrypt the response data using partner's public key
        const dataToEncrypt = JSON.stringify(responseData);
        const encryptedData = crypto.publicEncrypt({
          key: partner.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        }, Buffer.from(dataToEncrypt));
        
        finalResponseData = {
          encryptedData: encryptedData.toString('base64'),
          encrypted: true
        };
        
        console.log(`✅ Data encrypted for partner ${partnerId}`);
      } catch (error) {
        console.error(`❌ Failed to encrypt data for partner ${partnerId}:`, error);
        // Fall back to unencrypted data if encryption fails
        finalResponseData = responseData;
      }
    } else {
      console.log(`⚠️ No public key found for partner ${partnerId}, sending unencrypted data`);
    }

    // Log the data request
    await auditService.logEvent({
      eventType: 'data_request_fulfilled',
      actorType: 'partner',
      actorId: req.user._id,
      consentId,
      customerId: consent.customerId,
      partnerId,
      actionDetails: { 
        requestId,
        consentId,
        requestedFields,
        purpose
      },
      metadata: { ip: req.ip }
    });

    res.status(200).json({
      status: 'success',
      data: {
        requestId,
        consentId,
        status: 'success',
        data: finalResponseData,
        signature: responseSignature,
        timestamp: new Date().toISOString(),
        expiresAt: dataRequest.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get partner's consents
// @route   GET /api/v1/partner/consents
// @access  Partner
export const getPartnerConsents = async (req, res, next) => {
  try {
    const partnerId = req.user.partnerId;

    if (!partnerId) {
      return res.status(403).json({
        status: 'error',
        message: 'Only partners can access this endpoint'
      });
    }

    const consents = await Consent.find({ 
      partnerId,
      status: 'active' // Only show active consents
    });

    res.status(200).json({
      status: 'success',
      results: consents.length,
      data: {
        consents
      }
    });
  } catch (error) {
    next(error);
  }
};
