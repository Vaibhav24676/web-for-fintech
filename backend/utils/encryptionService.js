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

  // Generate a hash for search indexing
  createHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}

export default new EncryptionService();
