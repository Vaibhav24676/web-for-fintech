# Bank Backend API System

This is a production-ready Bank Backend API system for a consent-based data sharing platform built with the MERN stack.

## Core Services

- **Consent Management Service**: CRUD operations for managing consent
- **Customer Data Service**: Secure storage and retrieval of customer data
- **Partner Integration Service**: Secure API endpoints for partners
- **Audit Service**: Immutable logging of all actions
- **Notification Service**: Real-time notifications for consent events
- **Authentication Service**: JWT-based authentication
- **Key Management Service**: Management of encryption keys

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Security**: JWT, AES-256-GCM encryption
- **API Documentation**: Swagger/OpenAPI

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables
4. Start the server: `npm run dev`
5. Create admin user: `node fix-admin-proper.js`
6. Run tests: `node test-api.js`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fintech-bank
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=30d
NODE_ENV=development
API_BASE_URL=http://localhost:5000/api/v1
MIN_CONSENT_DURATION_MS=3600000
ENCRYPTION_KEY=your_32_byte_encryption_key
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with email and password
- `POST /api/v1/auth/signup` - Create a new user account
- `POST /api/v1/auth/refresh-token` - Refresh JWT token
- `POST /api/v1/auth/verify-token` - Verify JWT token

### Customers
- `POST /api/v1/customers` - Create a new customer
- `GET /api/v1/customers` - List all customers
- `GET /api/v1/customers/:customerId` - Get customer details
- `PUT /api/v1/customers/:customerId` - Update customer
- `DELETE /api/v1/customers/:customerId` - Delete customer

### Consents
- `POST /api/v1/consents` - Create a new consent
- `GET /api/v1/consents` - List all consents
- `GET /api/v1/consents/:consentId` - Get consent details
- `PUT /api/v1/consents/:consentId` - Update consent
- `DELETE /api/v1/consents/:consentId` - Revoke consent

### Partners
- `POST /api/v1/partners` - Register a new partner
- `GET /api/v1/partners` - List all partners
- `GET /api/v1/partners/:partnerId` - Get partner details
- `PUT /api/v1/partners/:partnerId` - Update partner
- `DELETE /api/v1/partners/:partnerId` - Delete partner

### Audit
- `GET /api/v1/audit/logs` - Get all audit logs (admin only)
- `GET /api/v1/audit/consents/:consentId` - Get audit logs for a consent
- `GET /api/v1/audit/customers/:customerId` - Get audit logs for a customer
- `GET /api/v1/audit/partners/:partnerId` - Get audit logs for a partner

## Known Issues and Solutions

1. **Admin Authentication**: To ensure proper admin role recognition, admin users should have email 'admin@fintechbank.com' and role 'admin'.
2. **MongoDB Indexes**: There's a warning about duplicate schema index on `expires_at`. This is a Mongoose internal issue that doesn't affect functionality.
3. **Partner Portal Integration**: Partner Portal integration is optional and the main API will function without it.

## Maintenance Notes

- Run `node fix-admin-proper.js` if admin authentication stops working
- Check database connectivity using the `/health` endpoint
- API tests can be run with `node test-api.js`
- Partner Portal specific tests can be run with `node test-integration.js`
