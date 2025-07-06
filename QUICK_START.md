# 🚀 Quick Start Testing Guide

## Step 1: Setup Environment

1. **Copy environment template:**
   ```bash
   copy .env.test .env
   ```

2. **Start MongoDB** (if not already running):
   ```bash
   # If using MongoDB locally:
   mongod
   
   # Or if using Docker:
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

## Step 2: Start the Server

Choose one of these options:

### Option A: Development mode (recommended)
```bash
cd backend
npm run dev
```

### Option B: Production mode
```bash
cd backend
npm start
```

### Option C: Use the helper script
```bash
node dev-start.js
```

## Step 3: Verify Server is Running

Open another terminal and test:

```bash
# Quick health check
curl http://localhost:5000/health

# Or open in browser:
# http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-07-06T...",
  "services": {
    "main_api": "healthy",
    "database": "connected",
    "partner_portal": "healthy"
  }
}
```

## Step 4: Run Automated Tests

```bash
# Run comprehensive API tests
node test-api.js

# Run module import tests
node test-modules.js
```

## Step 5: Manual Testing

Follow the detailed manual testing guide in `TESTING_GUIDE.md` or use these quick tests:

### Quick API Test Sequence:

1. **Create Admin User:**
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@test.com","password":"Admin123!","role":"admin"}'
   ```

2. **Login Admin:**
   ```bash
   curl -X POST http://localhost:5000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@test.com","password":"Admin123!"}'
   ```

3. **Test Protected Endpoint (use token from login):**
   ```bash
   curl -X GET http://localhost:5000/api/v1/customers \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## 🐛 Troubleshooting

### Server won't start:
- Check if MongoDB is running
- Check port 5000 is not in use
- Run `npm install` in both `/backend` and `/partner-portal` directories

### Database connection errors:
- Verify MongoDB is running on port 27017
- Check `.env` file has correct MONGODB_URI

### Partner Portal errors:
- Check console logs for specific errors
- Ensure all dependencies are installed

### Import/Export errors:
- Verify all files use ES6 modules
- Check file extensions are `.js`

## 📊 What to Look For

### ✅ Success Indicators:
- Server starts without errors
- Health endpoint returns "healthy"
- Database shows "connected"
- Partner Portal shows "healthy" or "not_available"
- API tests pass
- Authentication works
- CRUD operations succeed

### ❌ Error Indicators:
- MongoDB connection failures
- Import/export syntax errors
- JWT token errors
- Partner Portal initialization failures
- 500 internal server errors

## 🎯 Next Steps

Once basic testing works:

1. **Test all endpoints** using TESTING_GUIDE.md
2. **Load testing** with multiple concurrent requests
3. **Integration testing** with Partner Portal features
4. **Error handling** testing with invalid inputs
5. **Security testing** for authentication and authorization

## 🔧 Development Tips

- Use `npm run dev` for auto-reload during development
- Check server logs for detailed error information
- Use browser dev tools for API testing
- Install REST client like Postman for complex testing
- Monitor MongoDB logs for database issues
