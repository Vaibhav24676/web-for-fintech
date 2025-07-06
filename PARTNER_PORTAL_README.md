# Partner Portal Integration

This document describes the Partner Portal feature that has been integrated into the existing fintech backend system.

## 🎯 Overview

The Partner Portal provides a secure, consent-based data sharing system that allows approved partners to:
- Receive contract signing notifications
- Request encrypted user data from the bank
- Access stored data with proper consent validation
- Monitor all activities through immutable audit logs
- Automatically handle data expiry and cleanup

## 🏗️ Architecture

### Dual Database Design
- **PRIMARY DB** (Existing): Contains users, customers, partners, consents, audit logs
- **SECONDARY DB** (New): Contains partner-specific contract logs, user data, and audit trails

### Data Flow
```
Customer signs consent (Primary DB) 
    ↓ webhook trigger
Partner Portal receives contract notification (Secondary DB)
    ↓ partner requests data
System validates consent (Primary DB) + calls bank API
    ↓ stores encrypted data
Data stored in Partner Portal (Secondary DB)
    ↓ automatic expiry
Background job cleans expired data
```

## 📁 Project Structure

```
fintech-backend/
├── backend/ (existing - unchanged)
└── partner-portal/ (new)
    ├── config/
    │   └── partnerDb.js
    ├── models/
    │   ├── ContractLog.js
    │   ├── UserData.js
    │   └── PartnerAuditLog.js
    ├── controllers/
    │   ├── ContractController.js
    │   ├── DataController.js
    │   └── AuditController.js
    ├── routes/
    │   ├── contracts.js
    │   ├── data.js
    │   └── audit.js
    ├── services/
    │   ├── consentValidator.js
    │   ├── dataExpiryJob.js
    │   └── bankApiClient.js
    ├── middleware/
    │   └── partnerPortalAuth.js
    └── index.js
```

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd backend
npm install node-cron
```

### 2. Environment Configuration
Copy `.env.example` and configure:

```env
# Partner Portal Database
PARTNER_DB_URI=mongodb://localhost:27017/partner_portal

# Bank API
BANK_API_URL=https://bank-api.example.com
BANK_API_KEY=your_bank_api_key

# RSA Keys
RSA_PRIVATE_KEY_PATH=./keys/partner_private_key.pem
RSA_PUBLIC_KEY_PATH=./keys/partner_public_key.pem

# Authentication
PARTNER_PORTAL_SECRET=your_partner_portal_jwt_secret
PARTNER_PORTAL_API_KEY=partner-portal-webhook-key
```

### 3. Generate RSA Keys
```bash
mkdir keys
# Generate private key
openssl genpkey -algorithm RSA -out keys/partner_private_key.pem -pkcs8 -pass pass:your_passphrase
# Extract public key
openssl rsa -pubout -in keys/partner_private_key.pem -out keys/partner_public_key.pem
```

### 4. Start the Server
```bash
npm start
```

## 🔗 API Endpoints

### Contract Management
- `POST /api/v1/partner-portal/webhook/consent-received` - Receive contract notifications
- `GET /api/v1/partner-portal/contracts` - List partner contracts
- `GET /api/v1/partner-portal/contracts/:consent_id` - Get specific contract
- `PATCH /api/v1/partner-portal/contracts/:consent_id` - Update contract status
- `GET /api/v1/partner-portal/contracts/stats` - Contract statistics

### Data Management
- `POST /api/v1/partner-portal/data/request` - Request user data from bank
- `GET /api/v1/partner-portal/data/:consent_id` - Get decrypted user data
- `GET /api/v1/partner-portal/data/:consent_id/status` - Check data status
- `GET /api/v1/partner-portal/data/stats` - Data statistics
- `GET /api/v1/partner-portal/data` - List all partner data

### Audit & Compliance
- `GET /api/v1/partner-portal/audit` - Get audit logs
- `GET /api/v1/partner-portal/audit/:audit_id` - Get audit log details
- `GET /api/v1/partner-portal/audit/stats` - Audit statistics
- `GET /api/v1/partner-portal/audit/consent/:consent_id` - Consent-specific audits
- `GET /api/v1/partner-portal/audit/export` - Export audit logs (CSV)
- `POST /api/v1/partner-portal/audit/verify` - Verify audit integrity

## 🔐 Authentication

### Partner Portal JWT
Partners use JWT tokens for API access:

```javascript
// Generate token (from main backend)
import { generatePartnerPortalToken } from './partner-portal/middleware/partnerPortalAuth.js';

const token = generatePartnerPortalToken('partner-123', '24h');
```

### API Request Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## 📊 Data Models

### ContractLog (Secondary DB)
```javascript
{
  consent_id: String (unique),
  user_id: String,
  contract_purpose: String,
  signed_at: Date,
  contract_expiry: Date,
  partner_id: String,
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED',
  allowed_data_fields: [String],
  retention_period_days: Number
}
```

### UserData (Secondary DB)
```javascript
{
  consent_id: String,
  partner_id: String,
  encrypted_data: String,
  data_hash: String,
  received_at: Date,
  expires_at: Date,
  data_fields: [String],
  bank_signature: String,
  status: 'ACTIVE' | 'EXPIRED' | 'DELETED'
}
```

### PartnerAuditLog (Secondary DB)
```javascript
{
  event_type: String,
  consent_id: String,
  partner_id: String,
  timestamp: Date,
  status: 'SUCCESS' | 'FAILURE' | 'PENDING',
  message: String,
  ip_address: String,
  hash: String (for integrity)
}
```

## 🔄 Integration Examples

### Contract Notification Webhook
```bash
curl -X POST http://localhost:5000/api/v1/partner-portal/webhook/consent-received \
  -H "Content-Type: application/json" \
  -H "X-API-Key: partner-portal-webhook-key" \
  -d '{
    "consent_id": "consent-123",
    "user_id": "user-456",
    "contract_purpose": "Credit scoring",
    "contract_expiry": "2024-12-31T23:59:59Z",
    "partner_id": "partner-789",
    "allowed_data_fields": ["name", "email", "credit_score"],
    "retention_period_days": 30
  }'
```

### Request User Data
```bash
curl -X POST http://localhost:5000/api/v1/partner-portal/data/request \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "consent_id": "consent-123",
    "data_fields": ["name", "email"]
  }'
```

### Access Stored Data
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/data/consent-123 \
  -H "Authorization: Bearer <jwt_token>"
```

## ⚙️ Background Services

### Data Expiry Job
- Runs daily at midnight UTC
- Automatically deletes expired user data
- Creates audit logs for all deletions
- Can be manually triggered or configured

```javascript
import dataExpiryService from './partner-portal/services/dataExpiryJob.js';

// Manual cleanup
await dataExpiryService.runExpiryCleanup();

// Get service stats
const stats = dataExpiryService.getStats();
```

## 🛡️ Security Features

### Data Encryption
- All user data encrypted with RSA-OAEP-256
- Data decrypted only in memory, never stored decrypted
- SHA-256 hashes for data integrity verification

### Audit Trail
- Immutable audit logs with cryptographic hashes
- Every operation logged with timestamps and IP addresses
- Audit integrity verification available

### Access Control
- JWT-based authentication for partners
- Consent validation against primary database
- Rate limiting and IP-based access controls

## 📈 Monitoring & Analytics

### Health Check
```bash
curl http://localhost:5000/health
```

### Partner Statistics
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/data/stats \
  -H "Authorization: Bearer <jwt_token>"
```

### Audit Analytics
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/audit/stats?days=30 \
  -H "Authorization: Bearer <jwt_token>"
```

## 🔧 Maintenance

### Database Maintenance
```javascript
// Check expired data
const expiredData = await getUserDataModel().findExpiredData();

// Manual cleanup for specific partner
await dataExpiryService.forceCleanupPartner('partner-123');

// Verify audit integrity
const isValid = await getPartnerAuditLogModel().verifyIntegrity(auditId);
```

### Backup Considerations
- Regular backups of both PRIMARY and SECONDARY databases
- Audit logs are immutable and should be backed up frequently
- RSA keys should be securely backed up and rotated periodically

## 🚨 Error Handling

The system includes comprehensive error handling:
- All errors logged to audit trail
- Graceful degradation when external services fail
- Detailed error responses for debugging
- Automatic retry mechanisms for transient failures

## 📝 Compliance

### Data Retention
- Automatic data expiry based on consent retention periods
- Manual data deletion capabilities
- Audit trail of all data lifecycle events

### GDPR/Privacy
- Consent-based data access only
- Right to be forgotten (data deletion)
- Data minimization (only requested fields)
- Purpose limitation (data used only for stated purpose)

## 🔄 Migration Notes

This integration:
- ✅ Does not modify existing database schemas
- ✅ Does not change existing API endpoints
- ✅ Maintains backward compatibility
- ✅ Can be disabled without affecting main system
- ✅ Uses separate database for partner data

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PARTNER_DB_URI in .env
   - Ensure MongoDB is running
   - Verify network connectivity

2. **RSA Key Errors**
   - Verify key file paths and permissions
   - Regenerate keys if corrupted
   - Check key format (PKCS#8 for private key)

3. **Bank API Failures**
   - Check BANK_API_URL and credentials
   - Verify mTLS certificates if configured
   - Check network connectivity to bank API

4. **Token Validation Errors**
   - Verify PARTNER_PORTAL_SECRET
   - Check token expiration
   - Ensure partner is approved in primary database

### Logs
```bash
# View partner portal logs
tail -f logs/partner-portal.log

# View audit activity
curl -X GET "http://localhost:5000/api/v1/partner-portal/audit?event_type=SYSTEM_ERROR" \
  -H "Authorization: Bearer <jwt_token>"
```
