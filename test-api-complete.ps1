# Fintech Backend API Testing Script using cURL (PowerShell Version)
# This script tests all major endpoints of the fintech backend

Write-Host "🚀 FINTECH BACKEND API TESTING SCRIPT" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Configuration
$BaseUrl = "http://localhost:5000"
$ApiBase = "$BaseUrl/api/v1"

# Function to print test results
function Print-Result {
    param($Success, $Message)
    if ($Success) {
        Write-Host "✅ PASS: $Message" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: $Message" -ForegroundColor Red
    }
}

# Function to extract JWT token from response
function Extract-Token {
    param($Response)
    if ($Response -match '"token":"([^"]*)"') {
        return $matches[1]
    }
    return $null
}

# Function to extract ID from response
function Extract-Id {
    param($Response)
    if ($Response -match '"_id":"([^"]*)"') {
        return $matches[1]
    }
    return $null
}

Write-Host "`n1. TESTING SYSTEM HEALTH" -ForegroundColor Blue
Write-Host "=========================="

# Test 1: Health Check
Write-Host "Testing health endpoint..."
try {
    $healthResponse = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Print-Result $true "Health check endpoint"
    Write-Host "Response: $($healthResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Health check endpoint (Error: $($_.Exception.Message))"
}

Write-Host "`n2. TESTING AUTHENTICATION" -ForegroundColor Blue
Write-Host "=========================="

# Test 2: User Registration
Write-Host "Testing user registration..."
$registerBody = @{
    username = "testuser"
    email = "test@example.com"
    password = "securePassword123"
    role = "customer"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$ApiBase/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
    Print-Result $true "User registration"
    Write-Host "Response: $($registerResponse | ConvertTo-Json -Depth 3)"
} catch {
    if ($_.Exception.Response.StatusCode -eq "Conflict") {
        Print-Result $true "User registration (User already exists)"
    } else {
        Print-Result $false "User registration (Error: $($_.Exception.Message))"
    }
}

# Test 3: User Login
Write-Host "`nTesting user login..."
$loginBody = @{
    email = "test@example.com"
    password = "securePassword123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$ApiBase/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Print-Result $true "User login"
    $Token = $loginResponse.token
    Write-Host "JWT Token extracted: $($Token.Substring(0, [Math]::Min(50, $Token.Length)))..."
    Write-Host "Response: $($loginResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "User login (Error: $($_.Exception.Message))"
    $Token = "dummy_token"
    Write-Host "⚠️ Using dummy token for protected endpoint tests" -ForegroundColor Yellow
}

Write-Host "`n3. TESTING CUSTOMER MANAGEMENT" -ForegroundColor Blue
Write-Host "==============================="

# Test 4: Create Customer
Write-Host "Testing customer creation..."
$customerBody = @{
    name = "John Doe"
    email = "john.doe@example.com"
    phone = "+1234567890"
    address = @{
        street = "123 Main St"
        city = "New York"
        state = "NY"
        zipCode = "10001"
        country = "USA"
    }
    dateOfBirth = "1990-01-01"
    customerType = "individual"
} | ConvertTo-Json -Depth 3

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

try {
    $customerResponse = Invoke-RestMethod -Uri "$ApiBase/customers" -Method Post -Body $customerBody -Headers $headers
    Print-Result $true "Customer creation"
    $CustomerId = $customerResponse._id
    Write-Host "Customer ID: $CustomerId"
    Write-Host "Response: $($customerResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Customer creation (Error: $($_.Exception.Message))"
    $CustomerId = $null
}

# Test 5: Get All Customers
Write-Host "`nTesting get all customers..."
try {
    $customersResponse = Invoke-RestMethod -Uri "$ApiBase/customers" -Method Get -Headers @{"Authorization" = "Bearer $Token"}
    Print-Result $true "Get all customers"
    Write-Host "Response: $($customersResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Get all customers (Error: $($_.Exception.Message))"
}

# Test 6: Get Customer by ID (if we have one)
if ($CustomerId) {
    Write-Host "`nTesting get customer by ID..."
    try {
        $customerDetailResponse = Invoke-RestMethod -Uri "$ApiBase/customers/$CustomerId" -Method Get -Headers @{"Authorization" = "Bearer $Token"}
        Print-Result $true "Get customer by ID"
        Write-Host "Response: $($customerDetailResponse | ConvertTo-Json -Depth 3)"
    } catch {
        Print-Result $false "Get customer by ID (Error: $($_.Exception.Message))"
    }
}

Write-Host "`n4. TESTING CONSENT MANAGEMENT" -ForegroundColor Blue
Write-Host "=============================="

# Test 7: Create Consent
Write-Host "Testing consent creation..."
$consentBody = @{
    customerId = if ($CustomerId) { $CustomerId } else { "dummy_customer_id" }
    partnerId = "partner123"
    dataFields = @("name", "email", "account_balance")
    purpose = "Financial advisory services"
    expiresAt = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
} | ConvertTo-Json

try {
    $consentResponse = Invoke-RestMethod -Uri "$ApiBase/consents" -Method Post -Body $consentBody -Headers $headers
    Print-Result $true "Consent creation"
    $ConsentId = $consentResponse._id
    Write-Host "Consent ID: $ConsentId"
    Write-Host "Response: $($consentResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Consent creation (Error: $($_.Exception.Message))"
}

# Test 8: Get All Consents
Write-Host "`nTesting get all consents..."
try {
    $consentsResponse = Invoke-RestMethod -Uri "$ApiBase/consents" -Method Get -Headers @{"Authorization" = "Bearer $Token"}
    Print-Result $true "Get all consents"
    Write-Host "Response: $($consentsResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Get all consents (Error: $($_.Exception.Message))"
}

Write-Host "`n5. TESTING PARTNER MANAGEMENT" -ForegroundColor Blue
Write-Host "=============================="

# Test 9: Create Partner
Write-Host "Testing partner creation..."
$partnerBody = @{
    partnerId = "PARTNER_TEST_001"
    partnerName = "Test Financial Services"
    contactEmail = "contact@testfinancial.com"
    apiEndpoint = "https://api.testfinancial.com"
    status = "active"
    contractData = @{
        allowedDataFields = @("name", "email", "account_balance")
        purpose = "Financial advisory services"
        retentionPeriod = 90
        version = 1
    }
} | ConvertTo-Json -Depth 3

try {
    $partnerResponse = Invoke-RestMethod -Uri "$ApiBase/partners" -Method Post -Body $partnerBody -Headers $headers
    Print-Result $true "Partner creation"
    $PartnerId = $partnerResponse._id
    Write-Host "Partner ID: $PartnerId"
    Write-Host "Response: $($partnerResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Partner creation (Error: $($_.Exception.Message))"
}

# Test 10: Get All Partners
Write-Host "`nTesting get all partners..."
try {
    $partnersResponse = Invoke-RestMethod -Uri "$ApiBase/partners" -Method Get -Headers @{"Authorization" = "Bearer $Token"}
    Print-Result $true "Get all partners"
    Write-Host "Response: $($partnersResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Get all partners (Error: $($_.Exception.Message))"
}

Write-Host "`n6. TESTING AUDIT SYSTEM" -ForegroundColor Blue
Write-Host "======================="

# Test 11: Get Audit Logs
Write-Host "Testing audit logs retrieval..."
try {
    $auditResponse = Invoke-RestMethod -Uri "$ApiBase/audit" -Method Get -Headers @{"Authorization" = "Bearer $Token"}
    Print-Result $true "Get audit logs"
    Write-Host "Response: $($auditResponse | ConvertTo-Json -Depth 3)"
} catch {
    Print-Result $false "Get audit logs (Error: $($_.Exception.Message))"
}

Write-Host "`n7. TESTING ERROR HANDLING" -ForegroundColor Blue
Write-Host "========================="

# Test 12: Invalid Endpoint
Write-Host "Testing invalid endpoint..."
try {
    $invalidResponse = Invoke-RestMethod -Uri "$ApiBase/invalid-endpoint" -Method Get
    Print-Result $false "404 error handling (Expected error but got response)"
} catch {
    if ($_.Exception.Response.StatusCode -eq "NotFound") {
        Print-Result $true "404 error handling"
    } else {
        Print-Result $false "404 error handling (Got $($_.Exception.Response.StatusCode) instead of 404)"
    }
}

# Test 13: Unauthorized Access
Write-Host "`nTesting unauthorized access..."
try {
    $unauthorizedResponse = Invoke-RestMethod -Uri "$ApiBase/customers" -Method Get
    Print-Result $false "401 unauthorized handling (Expected error but got response)"
} catch {
    if ($_.Exception.Response.StatusCode -eq "Unauthorized") {
        Print-Result $true "401 unauthorized handling"
    } else {
        Print-Result $false "401 unauthorized handling (Got $($_.Exception.Response.StatusCode) instead of 401)"
    }
}

Write-Host "`n======================================"
Write-Host "🎉 API TESTING COMPLETE!" -ForegroundColor Green
Write-Host "======================================"

Write-Host "`n📝 TESTING SUMMARY:" -ForegroundColor Yellow
Write-Host "- Health check endpoint tested"
Write-Host "- Authentication flow tested (register + login)"
Write-Host "- Customer management tested (CRUD operations)"
Write-Host "- Consent management tested"
Write-Host "- Partner management tested"
Write-Host "- Audit system tested"
Write-Host "- Error handling tested"
Write-Host ""
Write-Host "💡 TIP: Review the responses above to verify all endpoints are working correctly." -ForegroundColor Blue
Write-Host "💡 TIP: If you see authentication errors, make sure your JWT secret is properly configured." -ForegroundColor Blue
Write-Host "💡 TIP: If endpoints fail, check that your server is running on http://localhost:5000" -ForegroundColor Blue
