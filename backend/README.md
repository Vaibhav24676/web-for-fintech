# Bank Backend API System

This is a production-ready Bank Backend API system for a consent-based data sharing platform built with the MERN stack.

## Core Services

- **Consent Management Service**: CRUD operations for managing consent
- **Customer Data Service**: Secure storage and retrieval of customer data
- **Partner Integration Service**: Secure API endpoints for partners
- **Audit Service**: Immutable logging of all actions
- **Notification Service**: Real-time notifications for consent events
- **Authentication Service**: JWT and OAuth2 based authentication
- **Key Management Service**: Management of encryption keys

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Security**: JWT, OAuth2, AES-256-GCM encryption
- **API Documentation**: Swagger/OpenAPI

## Setup and Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables
4. Start the server: `npm run dev`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/fintech-bank
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=30d
NODE_ENV=development
```

## API Endpoints

See the API documentation at `/api-docs` when the server is running.
