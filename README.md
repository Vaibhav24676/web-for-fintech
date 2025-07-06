# Fintech Backend - Complete Banking API System

A comprehensive Node.js backend system for financial technology applications with dual-database architecture, Partner Portal integration, and robust security features.

## 🏗️ Architecture Overview

This system consists of two main components:
- **Main Backend API** - Core banking operations and customer management
- **Partner Portal** - External partner integration and data sharing

### Database Architecture
- **Primary Database** (`fintech_bank`) - Core banking data
- **Partner Portal Database** (`partner_portal`) - Partner contracts and shared data
- **Automatic Synchronization** - Real-time data sync between databases

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v6.0 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Vaibhav24676/web-for-fintech.git
   cd web-for-fintech/fintech-backend
   ```

2. **Install dependencies**
   ```bash
   # Install main backend dependencies
   cd backend
   npm install
   
   # Install partner portal dependencies
   cd ../partner-portal
   npm install
   
   # Return to root directory
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Main Database
   MONGODB_URI=mongodb://localhost:27017/fintech_bank
   PORT=5000
   
   # Partner Portal Database
   PARTNER_DB_URI=mongodb://localhost:27017/partner_portal
   
   # JWT Configuration
   JWT_SECRET=your_super_secure_jwt_secret_here
   JWT_EXPIRES_IN=24h
   
   # Environment
   NODE_ENV=development
   ```

4. **Set up databases**
   ```bash
   # Start MongoDB
   mongod
   
   # Initialize Partner Portal database
   node setup-partner-db.js
   ```

5. **Start the application**
   ```bash
   # Development mode with auto-restart
   node dev-start.js
   
   # Or start normally
   node backend/server.js
   ```

## 📊 Database Integration Tests

Verify both databases are working correctly:

```bash
# Run comprehensive integration tests
node test-database-integration.js

# Run simplified integration tests
node test-db-updated.js

# Test individual components
node test-partner-db-direct.js
```

## 🔧 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Customer Management
- `GET /api/v1/customers` - List customers
- `POST /api/v1/customers` - Create customer
- `GET /api/v1/customers/:id` - Get customer details
- `PUT /api/v1/customers/:id` - Update customer
- `DELETE /api/v1/customers/:id` - Delete customer

### Consent Management
- `POST /api/v1/consents` - Create consent
- `GET /api/v1/consents` - List consents
- `GET /api/v1/consents/:id` - Get consent details
- `PUT /api/v1/consents/:id/revoke` - Revoke consent

### Partner Management
- `GET /api/v1/partners` - List partners
- `POST /api/v1/partners` - Create partner
- `GET /api/v1/partners/:id` - Get partner details
- `PUT /api/v1/partners/:id` - Update partner

### Partner Portal Endpoints
- `GET /api/v1/partner-portal/contracts` - Partner contracts
- `POST /api/v1/partner-portal/data` - Data requests
- `GET /api/v1/partner-portal/audit` - Audit logs

### System Health
- `GET /health` - System health check
- `GET /api/v1/audit` - System audit logs

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Data Encryption** for sensitive information
- **Rate Limiting** to prevent abuse
- **Input Validation** and sanitization
- **CORS Protection** for cross-origin requests
- **Helmet.js** for security headers
- **Audit Logging** for all operations

## 🏢 Partner Portal Features

- **Contract Management** - Partner agreement tracking
- **Data Sharing** - Secure customer data sharing
- **Audit Trails** - Complete activity logging
- **Auto Expiry** - Automatic data cleanup
- **Consent Validation** - Real-time consent checking

## 📈 Database Synchronization

The system maintains data consistency between the main database and partner portal:

- **Real-time Sync** - Automatic partner data synchronization
- **Conflict Resolution** - Handles data conflicts gracefully
- **Fallback Mode** - Continues operation if one database is unavailable
- **Health Monitoring** - Continuous database health checks

## 🧪 Testing

### Run All Tests
```bash
# Database integration tests
node test-database-integration.js

# API endpoint tests
node test-api.js

# Partner portal tests
node test-portal-init.js
```

### Test Results Interpretation
- ✅ **FULLY OPERATIONAL** - Both databases working and synchronized
- ⚠️ **DEGRADED MODE** - Main database working, Partner Portal unavailable
- ❌ **CRITICAL FAILURE** - Main database unavailable

## 📁 Project Structure

```
fintech-backend/
├── backend/                    # Main backend application
│   ├── controllers/           # Route controllers
│   ├── middleware/            # Custom middleware
│   ├── models/               # Database models
│   ├── routes/               # API routes
│   ├── utils/                # Utility functions
│   └── server.js             # Main server file
├── partner-portal/            # Partner portal module
│   ├── config/               # Database configuration
│   ├── controllers/          # Partner controllers
│   ├── models/              # Partner data models
│   ├── routes/              # Partner routes
│   └── services/            # Background services
├── test-*.js                 # Integration tests
├── setup-partner-db.js       # Database setup script
└── docs/                     # Documentation
```

## 🔄 Development Workflow

1. **Make changes** to your code
2. **Run tests** to verify functionality:
   ```bash
   node test-db-updated.js
   ```
3. **Test API endpoints**:
   ```bash
   node test-api.js
   ```
4. **Check system health**:
   ```bash
   curl http://localhost:5000/health
   ```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-production-db/fintech_bank
PARTNER_DB_URI=mongodb://your-production-db/partner_portal
JWT_SECRET=your-very-secure-production-secret
ENCRYPTION_KEY=your-32-byte-encryption-key
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "backend/server.js"]
```

## 📚 Documentation

- [Quick Start Guide](QUICK_START.md)
- [Partner Integration Guide](PARTNER_INTEGRATION.md)
- [Partner Portal README](PARTNER_PORTAL_README.md)
- [Testing Guide](TESTING_GUIDE.md)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔧 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Kill existing Node processes
   taskkill /F /IM node.exe  # Windows
   # or
   killall node  # Linux/Mac
   ```

2. **Database connection failed**
   ```bash
   # Check MongoDB is running
   mongod --version
   
   # Verify connection string in .env
   MONGODB_URI=mongodb://localhost:27017/fintech_bank
   ```

3. **Partner Portal not connecting**
   ```bash
   # Run Partner Portal setup
   node setup-partner-db.js
   
   # Test Partner Portal connection
   node test-partner-db-direct.js
   ```

## 📞 Support

For support and questions:
- Open an issue on GitHub
- Check the [documentation](docs/)
- Run the health check: `GET /health`

---

**Built with ❤️ for secure and scalable fintech applications**
