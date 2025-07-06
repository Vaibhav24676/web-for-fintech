/**
 * Fintech Backend API Server
 * 
 * This is the main server file for the Fintech Banking API.
 * It provides endpoints for authentication, customer management,
 * consent management, partner management, and audit logging.
 * 
 * The server also optionally integrates with the Partner Portal,
 * but will continue to function if the Partner Portal is unavailable.
 * 
 * Environment variables:
 * - PORT: The port to run the server on (default: 5000)
 * - MONGODB_URI: The MongoDB connection string
 * - JWT_SECRET: Secret key for JWT token generation
 * - JWT_EXPIRES_IN: JWT token expiration time (e.g., '1d' for 1 day)
 * - API_BASE_URL: Base URL for API notifications (default: http://localhost:5000/api/v1)
 * - MIN_CONSENT_DURATION_MS: Minimum consent duration in milliseconds (default: 1 hour)
 * - ENCRYPTION_KEY: 32-byte key for data encryption (auto-generated in dev mode)
 * - NODE_ENV: 'development' or 'production'
 */

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import consentRoutes from './routes/consentRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';
import { logInfo, logError, logWarn, logDetail } from './utils/loggerService.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Partner Portal Integration
let partnerPortal = null;
let partnerSyncService = null;

async function initializePartnerPortal() {
  try {
    partnerPortal = await import('../partner-portal/index.js');
    logInfo('Partner Portal module loaded successfully');
    
    // Initialize Partner Portal
    try {
      await partnerPortal.initializePartnerPortal();
      logInfo('Partner Portal initialized successfully');
      
      // Register Partner Portal routes after successful initialization
      await registerPartnerPortalRoutes();
      
      // Initialize Partner Sync Service
      try {
        partnerSyncService = (await import('./utils/partnerSyncService.js')).default;
        const syncInterval = parseInt(process.env.PARTNER_SYNC_INTERVAL || '3600000');
        partnerSyncService.initialize(syncInterval);
        logInfo('Partner Sync Service initialized', { syncIntervalMs: syncInterval });
        
        // Perform initial sync
        partnerSyncService.syncPartnerData().catch(error => {
          logError('Initial partner data sync failed', { error: error.message });
        });
      } catch (syncError) {
        logError('Failed to initialize Partner Sync Service', { error: syncError.message });
      }
      
      return partnerPortal;
    } catch (initError) {
      logWarn('Partner Portal initialization failed', { error: initError.message });
      setupPartnerPortalRetry();
      return null;
    }
  } catch (error) {
    logWarn('Partner Portal not available', { error: error.message });
    return null;
  }
}

// Set API base URL for notifications if not provided in environment
if (!process.env.API_BASE_URL) {
  process.env.API_BASE_URL = 'http://localhost:5000/api/v1';
}

// Set minimum consent duration if not provided (default: 1 hour in milliseconds)
if (!process.env.MIN_CONSENT_DURATION_MS) {
  process.env.MIN_CONSENT_DURATION_MS = 60 * 60 * 1000; // 1 hour
}

// Middleware
app.use(helmet()); // Set security headers
app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Request logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api', limiter);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/consents', consentRoutes);
app.use('/api/v1/partners', partnerRoutes);
app.use('/api/v1/audit', auditRoutes);

// Register Partner Portal routes if available
async function registerPartnerPortalRoutes() {
  if (partnerPortal) {
    try {
      partnerPortal.registerPartnerPortalRoutes(app);
      logInfo('Partner Portal routes registered successfully');
    } catch (error) {
      logError('Failed to register Partner Portal routes', { error: error.message });
    }
  }
}

// Root route
app.get('/', (req, res) => {
  res.send('Fintech Bank API is running');
});

// Function to check database health
function getDatabaseStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
  };
  return {
    status: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState
  };
}

// Enhanced health check with Partner Portal database status
app.get('/health', async (req, res) => {
  const dbStatus = getDatabaseStatus();
  
  // Basic health status
  const healthStatus = {
    status: dbStatus.status === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      main_api: 'healthy',
      database: {
        main: dbStatus,
        connectionString: process.env.MONGODB_URI ? '****' + process.env.MONGODB_URI.substr(-4) : 'not_set'
      }
    }
  };

  // Add Partner Portal health with enhanced details
  if (partnerPortal) {
    try {
      // Try to get Partner DB connection status first
      let partnerDbStatus = 'unknown';
      let connectionDetails = {};
      
      try {
        const partnerDb = await import('../partner-portal/config/partnerDb.js');
        const connStatus = partnerDb.getConnectionStatus();
        
        partnerDbStatus = connStatus.partner.isConnected ? 'connected' : 'disconnected';
        connectionDetails = {
          lastError: connStatus.partner.lastError,
          lastConnectAttempt: connStatus.partner.lastConnectAttempt,
          reconnectAttempts: connStatus.partner.reconnectAttempts
        };
        
        if (connStatus.partner.lastError) {
          connectionDetails.lastErrorMessage = connStatus.partner.lastError;
        }
      } catch (dbError) {
        partnerDbStatus = 'error';
        connectionDetails.error = dbError.message;
      }
      
      // Get sync status if available
      let syncStatus = { status: 'unavailable' };
      try {
        if (!partnerSyncService) {
          partnerSyncService = (await import('./utils/partnerSyncService.js')).default;
        }
        syncStatus = partnerSyncService.getStatus();
      } catch (syncError) {
        syncStatus = { 
          status: 'error', 
          error: syncError.message 
        };
      }
      
      // Determine overall partner portal status
      let overallStatus = 'unknown';
      if (partnerDbStatus === 'connected' && syncStatus.lastSyncTime) {
        overallStatus = 'healthy';
      } else if (partnerDbStatus === 'connected') {
        overallStatus = 'degraded';
      } else if (partnerDbStatus === 'disconnected') {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'error';
      }
      
      // Build partner portal health data
      const partnerHealth = {
        partner_portal: {
          status: overallStatus,
          database: partnerDbStatus,
          connection: connectionDetails,
          sync: syncStatus,
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      // Merge with main health status
      healthStatus.services = { ...healthStatus.services, ...partnerHealth };
      
      // Update overall system status
      if (healthStatus.services.database.main.status === 'connected') {
        if (partnerDbStatus === 'connected') {
          healthStatus.status = 'healthy';
        } else {
          healthStatus.status = 'degraded';
          healthStatus.degraded_reason = 'Partner Portal database unavailable';
        }
      } else {
        healthStatus.status = 'critical';
        healthStatus.critical_reason = 'Main database unavailable';
      }
    } catch (error) {
      healthStatus.services.partner_portal = { 
        status: 'error', 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
    }
  } else {
    healthStatus.services.partner_portal = { status: 'not_available' };
  }

  res.json(healthStatus);
});

// Set up better error handling for Partner Portal integration
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('Partner Portal')) {
    logError('Partner Portal Error', { 
      error: err.message,
      path: req.path,
      method: req.method
    });
    // Continue processing the request without the Partner Portal
    return next();
  }
  // Pass other errors to the main error handler
  next(err);
});

// Error handler middleware
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000; // Using port 5000 as specified

// Set Mongoose options to reduce warnings
mongoose.set('strictQuery', true);

// Function to attempt Partner Portal connection with retry
async function connectPartnerPortalWithRetry() {
  try {
    logInfo('Attempting to reconnect to Partner Portal');
    
    // Try to load the module if not already loaded
    if (!partnerPortal) {
      partnerPortal = await import('../partner-portal/index.js');
      logInfo('Partner Portal module loaded successfully');
    }
    
    // Initialize Partner Portal
    await partnerPortal.initializePartnerPortal();
    logInfo('Partner Portal initialized successfully');
    
    // Register Partner Portal routes after successful initialization
    await registerPartnerPortalRoutes();
    
    // Initialize Partner Sync Service if not already initialized
    if (!partnerSyncService) {
      partnerSyncService = (await import('./utils/partnerSyncService.js')).default;
      const syncInterval = parseInt(process.env.PARTNER_SYNC_INTERVAL || '3600000');
      partnerSyncService.initialize(syncInterval);
      logInfo('Partner Sync Service initialized', { syncIntervalMs: syncInterval });
    }
    
    // Perform a data sync after reconnection
    partnerSyncService.syncPartnerData().catch(error => {
      logError('Partner data sync after reconnection failed', { error: error.message });
    });
    
    return true;
  } catch (error) {
    logError('Failed to reconnect to Partner Portal', { error: error.message });
    
    // Set up another retry if enabled
    if (process.env.ENABLE_PARTNER_PORTAL_RETRY === 'true') {
      const retryInterval = parseInt(process.env.PARTNER_PORTAL_RETRY_INTERVAL || '300000');
      logInfo(`Will retry Partner Portal connection in ${retryInterval/1000} seconds`);
      
      setTimeout(() => {
        connectPartnerPortalWithRetry().catch(err => {
          logError('Partner Portal reconnection failed', { error: err.message });
        });
      }, retryInterval);
    }
    
    return false;
  }
}

// Function to set up Partner Portal retry mechanism
function setupPartnerPortalRetry() {
  // Set up retry mechanism
  if (process.env.ENABLE_PARTNER_PORTAL_RETRY === 'true') {
    const retryInterval = parseInt(process.env.PARTNER_PORTAL_RETRY_INTERVAL || '300000');
    logInfo(`Will retry Partner Portal connection in ${retryInterval/1000} seconds`);
    
    setTimeout(() => {
      logInfo('Attempting to reconnect to Partner Portal');
      connectPartnerPortalWithRetry().catch(err => {
        logError('Partner Portal reconnection failed', { error: err.message });
      });
    }, retryInterval);
  } else {
    logInfo('Partner Portal retry disabled, continuing without Partner Portal');
  }
}

// Connect to MongoDB with appropriate error handling
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 20
  })
  .then(async () => {
    logInfo('Connected to MongoDB', { database: process.env.MONGODB_URI });
    
    // Initialize Partner Portal module (loads the code but doesn't connect to DB yet)
    try {
      partnerPortal = await initializePartnerPortal();
      
      // Start the server regardless of Partner Portal status
      const server = app.listen(PORT, () => {
        logInfo(`Server running on port ${PORT}`);
        logInfo(`API Base URL for partners: ${process.env.API_BASE_URL}`);
        
        if (partnerPortal) {
          logInfo('Partner Portal endpoints available', { path: '/api/v1/partner-portal/*' });
        }
        
        // Initialize Partner Sync Service after server starts
        if (process.env.ENABLE_PARTNER_SYNC === 'true') {
          import('./utils/partnerSyncService.js')
            .then(module => {
              partnerSyncService = module.default;
              const syncInterval = parseInt(process.env.PARTNER_SYNC_INTERVAL || '3600000');
              partnerSyncService.initialize(syncInterval);
              logInfo('Partner Sync Service initialized', { syncIntervalMs: syncInterval });
            })
            .catch(syncError => {
              logError('Failed to initialize Partner Sync Service', { error: syncError.message });
            });
        } else {
          logInfo('Partner Sync Service disabled by configuration');
        }
      });
    } catch (error) {
      logError('Failed to initialize Partner Portal', { error: error.message });
      
      // Start the server even if Partner Portal initialization fails
      const server = app.listen(PORT, () => {
        logInfo(`Server running on port ${PORT} (without Partner Portal)`);
        logInfo(`API Base URL for partners: ${process.env.API_BASE_URL}`);
      });
    }
  })
  .catch((error) => {
    logError('Failed to connect to MongoDB', { error: error.message });
    process.exit(1);
  });
