import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class EncryptionService {
  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8');
    if (this.key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }
  }

  // AES-256-GCM encryption
  async encryptField(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    const hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    
    return { 
      encryptedValue: encrypted, 
      iv: iv.toString('hex'), 
      authTag: authTag.toString('hex'), 
      hash 
    };
  }

  async decryptField(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(encryptedData.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData.encryptedValue, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // RSA-OAEP with SHA-256 encryption using partner's public key
  // This encrypts data that only the partner can decrypt with their private key
  encryptWithPublicKey(data, publicKeyString) {
    try {
      console.log('Encryption input data:', data);
      console.log('Using public key:', publicKeyString.substring(0, 50) + '...');
      
      // Ensure public key is in PEM format
      const publicKey = publicKeyString.includes('-----BEGIN PUBLIC KEY-----')
        ? publicKeyString
        : `-----BEGIN PUBLIC KEY-----\n${publicKeyString}\n-----END PUBLIC KEY-----`;

      // RSA can only encrypt limited data size (based on key size)
      // For larger data, we use a hybrid approach:
      // 1. Generate a random AES key
      // 2. Encrypt the data with the AES key
      // 3. Encrypt the AES key with the RSA public key
      // 4. Send both encrypted data and encrypted key

      // Generate a random AES-256 key
      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      
      console.log('Generated AES key and IV');

      // Encrypt the data with AES-256-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
      let encryptedData = cipher.update(data, 'utf8', 'base64');
      encryptedData += cipher.final('base64');
      const authTag = cipher.getAuthTag().toString('base64');
      
      console.log('AES encryption successful, data length:', encryptedData.length);

      // Encrypt the AES key with the partner's public key using RSA-OAEP with SHA-256
      const encryptedKey = crypto.publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        aesKey
      ).toString('base64');
      
      console.log('RSA encryption of AES key successful');

      // Return the encrypted package
      const result = {
        encryptedData,
        iv: iv.toString('base64'),
        authTag,
        encryptedKey,
        algorithm: 'RSA-OAEP-SHA256+AES-256-GCM'
      };
      
      console.log('Full encryption package created successfully');
      return result;
    } catch (error) {
      console.error('Public key encryption error:', error);
      throw new Error('Failed to encrypt data with public key');
    }
  }

  // Generate a hash for search indexing
  createHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

export default new EncryptionService();
