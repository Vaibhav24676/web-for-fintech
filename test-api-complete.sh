#!/bin/bash

# Fintech Backend API Testing Script using cURL
# This script tests all major endpoints of the fintech backend

echo "🚀 FINTECH BACKEND API TESTING SCRIPT"
echo "======================================"

# Configuration
BASE_URL="http://localhost:5000"
API_BASE="$BASE_URL/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    local status=$1
    local message=$2
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✅ PASS:${NC} $message"
    else
        echo -e "${RED}❌ FAIL:${NC} $message"
    fi
}

# Function to extract JWT token from response
extract_token() {
    echo "$1" | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

# Function to extract ID from response
extract_id() {
    echo "$1" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4
}

echo -e "\n${BLUE}1. TESTING SYSTEM HEALTH${NC}"
echo "=========================="

# Test 1: Health Check
echo "Testing health endpoint..."
response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$BASE_URL/health")
http_code="${response: -3}"
if [ "$http_code" -eq 200 ]; then
    print_result 0 "Health check endpoint"
    echo "Response: $(cat /tmp/health_response.json | jq '.' 2>/dev/null || cat /tmp/health_response.json)"
else
    print_result 1 "Health check endpoint (HTTP $http_code)"
fi

echo -e "\n${BLUE}2. TESTING AUTHENTICATION${NC}"
echo "=========================="

# Test 2: User Registration
echo "Testing user registration..."
register_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securePassword123",
    "role": "customer"
  }' \
  -w "%{http_code}" \
  "$API_BASE/auth/register")

register_http_code="${register_response: -3}"
register_body="${register_response%???}"

if [ "$register_http_code" -eq 201 ] || [ "$register_http_code" -eq 200 ]; then
    print_result 0 "User registration"
    echo "Response: $register_body"
else
    print_result 1 "User registration (HTTP $register_http_code)"
    echo "Response: $register_body"
fi

# Test 3: User Login
echo -e "\nTesting user login..."
login_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securePassword123"
  }' \
  -w "%{http_code}" \
  "$API_BASE/auth/login")

login_http_code="${login_response: -3}"
login_body="${login_response%???}"

if [ "$login_http_code" -eq 200 ]; then
    print_result 0 "User login"
    TOKEN=$(extract_token "$login_body")
    echo "JWT Token extracted: ${TOKEN:0:50}..."
    echo "Response: $login_body"
else
    print_result 1 "User login (HTTP $login_http_code)"
    echo "Response: $login_body"
fi

# If no token, create a dummy one for testing
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️ No valid token obtained, using dummy token for protected endpoint tests${NC}"
    TOKEN="dummy_token"
fi

echo -e "\n${BLUE}3. TESTING CUSTOMER MANAGEMENT${NC}"
echo "==============================="

# Test 4: Create Customer
echo "Testing customer creation..."
customer_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
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
    },
    "dateOfBirth": "1990-01-01",
    "customerType": "individual"
  }' \
  -w "%{http_code}" \
  "$API_BASE/customers")

customer_http_code="${customer_response: -3}"
customer_body="${customer_response%???}"

if [ "$customer_http_code" -eq 201 ] || [ "$customer_http_code" -eq 200 ]; then
    print_result 0 "Customer creation"
    CUSTOMER_ID=$(extract_id "$customer_body")
    echo "Customer ID: $CUSTOMER_ID"
    echo "Response: $customer_body"
else
    print_result 1 "Customer creation (HTTP $customer_http_code)"
    echo "Response: $customer_body"
fi

# Test 5: Get All Customers
echo -e "\nTesting get all customers..."
customers_response=$(curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}" \
  "$API_BASE/customers")

customers_http_code="${customers_response: -3}"
customers_body="${customers_response%???}"

if [ "$customers_http_code" -eq 200 ]; then
    print_result 0 "Get all customers"
    echo "Response: $customers_body"
else
    print_result 1 "Get all customers (HTTP $customers_http_code)"
    echo "Response: $customers_body"
fi

# Test 6: Get Customer by ID (if we have one)
if [ ! -z "$CUSTOMER_ID" ]; then
    echo -e "\nTesting get customer by ID..."
    customer_detail_response=$(curl -s -X GET \
      -H "Authorization: Bearer $TOKEN" \
      -w "%{http_code}" \
      "$API_BASE/customers/$CUSTOMER_ID")
    
    customer_detail_http_code="${customer_detail_response: -3}"
    customer_detail_body="${customer_detail_response%???}"
    
    if [ "$customer_detail_http_code" -eq 200 ]; then
        print_result 0 "Get customer by ID"
        echo "Response: $customer_detail_body"
    else
        print_result 1 "Get customer by ID (HTTP $customer_detail_http_code)"
        echo "Response: $customer_detail_body"
    fi
fi

echo -e "\n${BLUE}4. TESTING CONSENT MANAGEMENT${NC}"
echo "=============================="

# Test 7: Create Consent
echo "Testing consent creation..."
consent_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "'${CUSTOMER_ID:-"dummy_customer_id"}'",
    "partnerId": "partner123",
    "dataFields": ["name", "email", "account_balance"],
    "purpose": "Financial advisory services",
    "expiresAt": "'$(date -d '+30 days' -u +%Y-%m-%dT%H:%M:%S.000Z)'"
  }' \
  -w "%{http_code}" \
  "$API_BASE/consents")

consent_http_code="${consent_response: -3}"
consent_body="${consent_response%???}"

if [ "$consent_http_code" -eq 201 ] || [ "$consent_http_code" -eq 200 ]; then
    print_result 0 "Consent creation"
    CONSENT_ID=$(extract_id "$consent_body")
    echo "Consent ID: $CONSENT_ID"
    echo "Response: $consent_body"
else
    print_result 1 "Consent creation (HTTP $consent_http_code)"
    echo "Response: $consent_body"
fi

# Test 8: Get All Consents
echo -e "\nTesting get all consents..."
consents_response=$(curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}" \
  "$API_BASE/consents")

consents_http_code="${consents_response: -3}"
consents_body="${consents_response%???}"

if [ "$consents_http_code" -eq 200 ]; then
    print_result 0 "Get all consents"
    echo "Response: $consents_body"
else
    print_result 1 "Get all consents (HTTP $consents_http_code)"
    echo "Response: $consents_body"
fi

echo -e "\n${BLUE}5. TESTING PARTNER MANAGEMENT${NC}"
echo "=============================="

# Test 9: Create Partner
echo "Testing partner creation..."
partner_response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "partnerId": "PARTNER_TEST_001",
    "partnerName": "Test Financial Services",
    "contactEmail": "contact@testfinancial.com",
    "apiEndpoint": "https://api.testfinancial.com",
    "status": "active",
    "contractData": {
      "allowedDataFields": ["name", "email", "account_balance"],
      "purpose": "Financial advisory services",
      "retentionPeriod": 90,
      "version": 1
    }
  }' \
  -w "%{http_code}" \
  "$API_BASE/partners")

partner_http_code="${partner_response: -3}"
partner_body="${partner_response%???}"

if [ "$partner_http_code" -eq 201 ] || [ "$partner_http_code" -eq 200 ]; then
    print_result 0 "Partner creation"
    PARTNER_ID=$(extract_id "$partner_body")
    echo "Partner ID: $PARTNER_ID"
    echo "Response: $partner_body"
else
    print_result 1 "Partner creation (HTTP $partner_http_code)"
    echo "Response: $partner_body"
fi

# Test 10: Get All Partners
echo -e "\nTesting get all partners..."
partners_response=$(curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}" \
  "$API_BASE/partners")

partners_http_code="${partners_response: -3}"
partners_body="${partners_response%???}"

if [ "$partners_http_code" -eq 200 ]; then
    print_result 0 "Get all partners"
    echo "Response: $partners_body"
else
    print_result 1 "Get all partners (HTTP $partners_http_code)"
    echo "Response: $partners_body"
fi

echo -e "\n${BLUE}6. TESTING AUDIT SYSTEM${NC}"
echo "======================="

# Test 11: Get Audit Logs
echo "Testing audit logs retrieval..."
audit_response=$(curl -s -X GET \
  -H "Authorization: Bearer $TOKEN" \
  -w "%{http_code}" \
  "$API_BASE/audit")

audit_http_code="${audit_response: -3}"
audit_body="${audit_response%???}"

if [ "$audit_http_code" -eq 200 ]; then
    print_result 0 "Get audit logs"
    echo "Response: $audit_body"
else
    print_result 1 "Get audit logs (HTTP $audit_http_code)"
    echo "Response: $audit_body"
fi

echo -e "\n${BLUE}7. TESTING ERROR HANDLING${NC}"
echo "========================="

# Test 12: Invalid Endpoint
echo "Testing invalid endpoint..."
invalid_response=$(curl -s -X GET \
  -w "%{http_code}" \
  "$API_BASE/invalid-endpoint")

invalid_http_code="${invalid_response: -3}"

if [ "$invalid_http_code" -eq 404 ]; then
    print_result 0 "404 error handling"
else
    print_result 1 "404 error handling (Expected 404, got $invalid_http_code)"
fi

# Test 13: Unauthorized Access
echo -e "\nTesting unauthorized access..."
unauthorized_response=$(curl -s -X GET \
  -w "%{http_code}" \
  "$API_BASE/customers")

unauthorized_http_code="${unauthorized_response: -3}"

if [ "$unauthorized_http_code" -eq 401 ]; then
    print_result 0 "401 unauthorized handling"
else
    print_result 1 "401 unauthorized handling (Expected 401, got $unauthorized_http_code)"
fi

echo -e "\n${BLUE}8. TESTING RATE LIMITING${NC}"
echo "======================="

# Test 14: Rate Limiting (make multiple requests)
echo "Testing rate limiting (making 10 rapid requests)..."
rate_limit_passed=0
for i in {1..10}; do
    rate_response=$(curl -s -w "%{http_code}" "$BASE_URL/health")
    rate_http_code="${rate_response: -3}"
    
    if [ "$rate_http_code" -eq 429 ]; then
        print_result 0 "Rate limiting activated"
        rate_limit_passed=1
        break
    fi
    sleep 0.1
done

if [ $rate_limit_passed -eq 0 ]; then
    print_result 1 "Rate limiting (No rate limit detected)"
fi

echo -e "\n${GREEN}======================================"
echo "🎉 API TESTING COMPLETE!"
echo "======================================"
echo -e "${NC}"

# Cleanup temp files
rm -f /tmp/health_response.json

echo -e "\n${YELLOW}📝 TESTING SUMMARY:${NC}"
echo "- Health check endpoint tested"
echo "- Authentication flow tested (register + login)"
echo "- Customer management tested (CRUD operations)"
echo "- Consent management tested"
echo "- Partner management tested"
echo "- Audit system tested"
echo "- Error handling tested"
echo "- Rate limiting tested"
echo ""
echo -e "${BLUE}💡 TIP:${NC} Review the responses above to verify all endpoints are working correctly."
echo -e "${BLUE}💡 TIP:${NC} If you see authentication errors, make sure your JWT secret is properly configured."
echo -e "${BLUE}💡 TIP:${NC} If endpoints fail, check that your server is running on http://localhost:5000"
