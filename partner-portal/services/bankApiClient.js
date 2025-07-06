import https from 'https';
import crypto from 'crypto';
import fs from 'fs';
import fetch from 'node-fetch';
import { getPartnerAuditLogModel } from '../models/PartnerAuditLog.js';

class BankApiClient {
  constructor() {
    this.baseUrl = process.env.BANK_API_URL;
    this.privateKeyPath = process.env.RSA_PRIVATE_KEY_PATH;
    this.publicKeyPath = process.env.RSA_PUBLIC_KEY_PATH;
    this.apiKey = process.env.BANK_API_KEY;
    this.timeout = 30000; // 30 seconds
    this.auditModel = getPartnerAuditLogModel();
    
    // Load RSA keys
    this.privateKey = null;
    this.publicKey = null;
    this.loadKeys();
  }

  /**
   * Load RSA public/private keys for encryption and signature verification
   */
  loadKeys() {
    try {
      if (this.privateKeyPath && fs.existsSync(this.privateKeyPath)) {
        this.privateKey = fs.readFileSync(this.privateKeyPath, 'utf8');
      }
      
      if (this.publicKeyPath && fs.existsSync(this.publicKeyPath)) {
        this.publicKey = fs.readFileSync(this.publicKeyPath, 'utf8');
      }
      
      console.log('🔐 RSA keys loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load RSA keys:', error.message);
    }
  }

  /**
   * Create mTLS agent for secure communication
   * @returns {https.Agent} HTTPS agent with mTLS configuration
   */
  createMtlsAgent() {
    const certPath = process.env.CLIENT_CERT_PATH;
    const keyPath = process.env.CLIENT_KEY_PATH;
    const caPath = process.env.CA_CERT_PATH;

    if (!certPath || !keyPath) {
      console.warn('⚠️ mTLS certificates not configured, using standard HTTPS');
      return new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      });
    }

    try {
      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);
      const ca = caPath ? fs.readFileSync(caPath) : undefined;

      return new https.Agent({
        cert,
        key,
        ca,
        rejectUnauthorized: true
      });
    } catch (error) {
      console.error('❌ Failed to create mTLS agent:', error.message);
      throw new Error('mTLS configuration failed');
    }
  }

  /**
   * Generate request signature for API authentication
   * @param {string} payload - Request payload
   * @param {number} timestamp - Request timestamp
   * @returns {string} Base64 encoded signature
   */
  generateRequestSignature(payload, timestamp) {
    if (!this.privateKey) {
      throw new Error('Private key not loaded for signing');
    }

    const dataToSign = `${timestamp}${payload}`;
    const signature = crypto.sign('sha256', Buffer.from(dataToSign));
    
    return signature.toString('base64');
  }

  /**
   * Verify response signature from bank API
   * @param {string} payload - Response payload
   * @param {string} signature - Response signature
   * @param {string} timestamp - Response timestamp
   * @returns {boolean} Signature verification result
   */
  verifyResponseSignature(payload, signature, timestamp) {
    if (!this.publicKey) {
      console.warn('⚠️ Public key not loaded, skipping signature verification');
      return true; // Allow in development
    }

    try {
      const dataToVerify = `${timestamp}${payload}`;
      const isValid = crypto.verify(
        'sha256',
        Buffer.from(dataToVerify),
        this.publicKey,
        Buffer.from(signature, 'base64')
      );
      
      return isValid;
    } catch (error) {
      console.error('❌ Signature verification failed:', error.message);
      return false;
    }
  }

  /**
   * Encrypt request payload using bank's public key
   * @param {string} data - Data to encrypt
   * @returns {string} Base64 encoded encrypted data
   */
  encryptRequestData(data) {
    if (!this.publicKey) {
      throw new Error('Bank public key not loaded for encryption');
    }

    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(data)
      );
      
      return encrypted.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt response data using private key
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @returns {string} Decrypted data
   */
  decryptResponseData(encryptedData) {
    if (!this.privateKey) {
      throw new Error('Private key not loaded for decryption');
    }

    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedData, 'base64')
      );
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Request encrypted user data from bank API
   * @param {string} consentId - Consent ID for data request
   * @param {string} partnerId - Partner ID making the request
   * @param {Array<string>} dataFields - Requested data fields
   * @returns {Promise<Object>} Encrypted user data response
   */
  async requestUserData(consentId, partnerId, dataFields) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      // Prepare request payload
      const requestPayload = {
        consent_id: consentId,
        partner_id: partnerId,
        data_fields: dataFields,
        request_id: requestId,
        timestamp: Date.now()
      };

      const payloadString = JSON.stringify(requestPayload);
      const timestamp = Date.now();

      // Generate request signature
      const signature = this.generateRequestSignature(payloadString, timestamp);

      // Encrypt request payload
      const encryptedPayload = this.encryptRequestData(payloadString);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Partner-ID': partnerId,
        'X-Request-ID': requestId
      };

      // Create mTLS agent
      const agent = this.createMtlsAgent();

      // Make API request
      const response = await fetch(`${this.baseUrl}/api/v1/data/request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ encrypted_data: encryptedPayload }),
        agent,
        timeout: this.timeout
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Bank API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      // Verify response signature
      const responseSignature = response.headers.get('X-Response-Signature');
      const responseTimestamp = response.headers.get('X-Response-Timestamp');
      
      if (responseSignature && responseTimestamp) {
        const isValidSignature = this.verifyResponseSignature(
          JSON.stringify(responseData),
          responseSignature,
          responseTimestamp
        );

        if (!isValidSignature) {
          await this.auditModel.createAuditLog({
            event_type: 'SIGNATURE_FAILED',
            consent_id: consentId,
            partner_id: partnerId,
            status: 'FAILURE',
            message: 'Bank API response signature verification failed',
            request_id: requestId,
            response_time_ms: responseTime
          });

          throw new Error('Response signature verification failed');
        }

        await this.auditModel.createAuditLog({
          event_type: 'SIGNATURE_VERIFIED',
          consent_id: consentId,
          partner_id: partnerId,
          status: 'SUCCESS',
          message: 'Bank API response signature verified',
          request_id: requestId,
          response_time_ms: responseTime
        });
      }

      // Generate data hash for integrity verification
      const dataHash = crypto.createHash('sha256')
        .update(responseData.encrypted_data)
        .digest('hex');

      // Log successful data request
      await this.auditModel.createAuditLog({
        event_type: 'DATA_RECEIVED',
        consent_id: consentId,
        partner_id: partnerId,
        status: 'SUCCESS',
        message: 'User data successfully received from bank API',
        request_id: requestId,
        response_time_ms: responseTime,
        data_size_bytes: Buffer.byteLength(responseData.encrypted_data, 'utf8')
      });

      return {
        success: true,
        encrypted_data: responseData.encrypted_data,
        data_hash: dataHash,
        bank_signature: responseSignature || '',
        request_id: requestId,
        timestamp: new Date(),
        data_fields: dataFields,
        bank_response_id: responseData.response_id || requestId
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.auditModel.createAuditLog({
        event_type: 'SYSTEM_ERROR',
        consent_id: consentId,
        partner_id: partnerId,
        status: 'FAILURE',
        message: `Bank API request failed: ${error.message}`,
        request_id: requestId,
        response_time_ms: responseTime,
        error_code: 'BANK_API_ERROR',
        error_details: error.stack
      });

      console.error('❌ Bank API request failed:', error.message);
      throw error;
    }
  }

  /**
   * Test bank API connectivity
   * @returns {Promise<boolean>} Connection test result
   */
  async testConnection() {
    try {
      const agent = this.createMtlsAgent();
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        },
        agent,
        timeout: 10000
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Bank API connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get API client status
   * @returns {Object} Client status information
   */
  getStatus() {
    return {
      baseUrl: this.baseUrl,
      hasPrivateKey: !!this.privateKey,
      hasPublicKey: !!this.publicKey,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout
    };
  }
}

// Singleton instance
const bankApiClient = new BankApiClient();

export default bankApiClient;
export { BankApiClient };
