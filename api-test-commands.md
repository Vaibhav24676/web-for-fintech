# Fintech Backend API Testing with cURL

# 1. Health Check
curl -X GET http://localhost:5000/health

# 2. User Registration
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com", 
    "password": "securePassword123",
    "role": "customer"
  }'

# 3. User Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securePassword123"
  }'

# 4. Get Customers (replace YOUR_TOKEN with actual JWT token from login)
curl -X GET http://localhost:5000/api/v1/customers \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Create Customer
curl -X POST http://localhost:5000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St, City, Country"
  }'

# 6. Create Consent
curl -X POST http://localhost:5000/api/v1/consents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "CUSTOMER_ID",
    "partnerId": "PARTNER_ID",
    "dataFields": ["name", "email", "account_balance"],
    "purpose": "Financial advisory services",
    "durationMs": 3600000
  }'

# 7. Get Partners
curl -X GET http://localhost:5000/api/v1/partners \
  -H "Authorization: Bearer YOUR_TOKEN"

# 8. Create Partner
curl -X POST http://localhost:5000/api/v1/partners \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "partnerName": "Financial Advisory Inc",
    "contactEmail": "contact@financial.com",
    "businessType": "financial_services"
  }'
