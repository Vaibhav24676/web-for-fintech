# 🧪 Manual Testing Guide for Fintech Backend

This guide provides step-by-step instructions for manually testing the backend API endpoints using curl, Postman, or any HTTP client.

## Prerequisites

1. **Start the server:**
   ```bash
   cd backend
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

2. **Verify server is running:**
   ```bash
   curl http://localhost:5000/health
   ```

## 📋 Test Scenarios

### 1. Health Check
```bash
# Basic health check
curl -X GET http://localhost:5000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-07-06T...",
  "services": {
    "main_api": "healthy",
    "database": "connected",
    "partner_portal": "healthy" // or "not_available"
  }
}
```

### 2. Authentication Tests

#### Admin Signup
```bash
curl -X POST http://localhost:5000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@fintechbank.com",
    "password": "Admin123!@#",
    "role": "admin"
  }'
```

#### Admin Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@fintechbank.com",
    "password": "Admin123!@#"
  }'

# Save the returned token for authenticated requests
# Expected response includes: { "token": "eyJ...", "user": {...} }
```

### 3. Customer Management (Admin Required)

Replace `YOUR_TOKEN` with the token from login response.

#### Create Customer
```bash
curl -X POST http://localhost:5000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    }
  }'
```

#### Get All Customers
```bash
curl -X GET http://localhost:5000/api/v1/customers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Get Customer by ID
```bash
curl -X GET http://localhost:5000/api/v1/customers/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Partner Management (Admin Required)

#### Create Partner
```bash
curl -X POST http://localhost:5000/api/v1/partners \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Partner Corp",
    "email": "partner@testpartner.com",
    "description": "Test partner for API integration",
    "website": "https://testpartner.com",
    "contactPerson": {
      "name": "Partner Admin",
      "email": "partner@testpartner.com",
      "phone": "+1234567890"
    }
  }'

# Save the returned apiKey for partner requests
```

#### Get All Partners
```bash
curl -X GET http://localhost:5000/api/v1/partners \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Consent Management (Admin Required)

#### Create Consent
```bash
curl -X POST http://localhost:5000/api/v1/consents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID_FROM_ABOVE",
    "partnerId": "PARTNER_ID_FROM_ABOVE",
    "purpose": "account_verification",
    "dataTypes": ["personal_info", "account_balance"],
    "duration": 3600000
  }'
```

#### Get All Consents
```bash
curl -X GET http://localhost:5000/api/v1/consents \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Partner Portal Tests (Partner API Key Required)

Replace `PARTNER_API_KEY` with the API key from partner creation.

#### Get Partner Contracts
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/contracts \
  -H "Authorization: Bearer PARTNER_API_KEY" \
  -H "X-Partner-ID: PARTNER_ID"
```

#### Get Partner Data
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/data \
  -H "Authorization: Bearer PARTNER_API_KEY" \
  -H "X-Partner-ID: PARTNER_ID"
```

#### Get Partner Audit Logs
```bash
curl -X GET http://localhost:5000/api/v1/partner-portal/audit \
  -H "Authorization: Bearer PARTNER_API_KEY" \
  -H "X-Partner-ID: PARTNER_ID"
```

### 7. Audit Logs (Admin Required)

#### Get Audit Logs
```bash
curl -X GET http://localhost:5000/api/v1/audit \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔧 Testing with Postman

1. **Import the collection:**
   - Create a new collection in Postman
   - Add the base URL: `http://localhost:5000/api/v1`
   - Set up environment variables for tokens

2. **Authentication flow:**
   - First, run signup/login to get admin token
   - Set token as environment variable: `{{admin_token}}`
   - Use `Bearer {{admin_token}}` in Authorization header

3. **Test sequence:**
   - Health check
   - Admin login
   - Create customer
   - Create partner
   - Create consent
   - Test Partner Portal endpoints

## 🐛 Troubleshooting

### Common Issues:

1. **Server not starting:**
   ```bash
   # Check if MongoDB is running
   # Install dependencies
   cd backend && npm install
   cd ../partner-portal && npm install
   ```

2. **Database connection errors:**
   - Ensure MongoDB is running on localhost:27017
   - Check `.env` file for correct connection strings

3. **Partner Portal not available:**
   - Check console logs for initialization errors
   - Verify partner-portal dependencies are installed

4. **JWT Token errors:**
   - Ensure JWT_SECRET is set in environment
   - Check token is included in Authorization header

5. **CORS errors (if testing from browser):**
   - Backend includes CORS middleware
   - Check browser console for specific errors

## 📊 Expected Response Codes

- `200` - Success (GET, PUT)
- `201` - Created (POST)
- `400` - Bad Request (invalid data)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error

## 🔍 Monitoring

Watch server logs for:
- Request logging (Morgan middleware)
- Database connection status
- Partner Portal initialization
- Error messages and stack traces

The health endpoint provides real-time status of all services.
