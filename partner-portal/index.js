import { connectPartnerDb, connectSharedDb } from './config/partnerDb.js';
import dataExpiryService from './services/dataExpiryJob.js';

// Import routes
import contractRoutes from './routes/contracts.js';
import dataRoutes from './routes/data.js';
import auditRoutes from './routes/audit.js';

/**
 * Initialize Partner Portal
 * Sets up database connections and starts background services
 */
const initializePartnerPortal = async () => {
  try {
    console.log('🚀 Initializing Partner Portal...');

    // Connect to both databases first, before loading any models
    try {
      console.log('Connecting to databases first...');
      await connectPartnerDb();
      await connectSharedDb();
      console.log('Database connections established');
    } catch (dbError) {
      console.warn('⚠️ Partner Portal database connection failed:', dbError.message);
      console.log('🔄 Partner Portal will continue without database features...');
      throw dbError; // Rethrow to prevent proceeding with models that need DB connection
    }

    // Now load services that depend on database connection
    try {
      // Start data expiry service after DB connection
      dataExpiryService.start();
      console.log('⏰ Data expiry service started');
    } catch (serviceError) {
      console.warn('⚠️ Data expiry service failed to start:', serviceError.message);
    }

    console.log('✅ Partner Portal initialized successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Partner Portal:', error);
    throw error;
  }
};

/**
 * Shutdown Partner Portal
 * Cleanly stops services and closes connections
 */
const shutdownPartnerPortal = async () => {
  try {
    console.log('🛑 Shutting down Partner Portal...');

    // Stop data expiry service
    dataExpiryService.stop();

    // Database connections will be closed by the database module
    
    console.log('✅ Partner Portal shutdown complete');
  } catch (error) {
    console.error('❌ Error during Partner Portal shutdown:', error);
  }
};

/**
 * Register Partner Portal routes with Express app
 * @param {Express} app - Express application instance
 */
const registerPartnerPortalRoutes = (app) => {
  // Partner Portal routes
  app.use('/api/v1/partner-portal/contracts', contractRoutes);
  app.use('/api/v1/partner-portal/data', dataRoutes);
  app.use('/api/v1/partner-portal/audit', auditRoutes);

  console.log('🔗 Partner Portal routes registered');
};

/**
 * Get Partner Portal health status
 */
const getPartnerPortalHealth = () => {
  return {
    partner_portal: {
      status: 'healthy',
      services: {
        data_expiry: {
          running: dataExpiryService.getStats().isRunning,
          last_run: dataExpiryService.getStats().lastRun,
          total_runs: dataExpiryService.getStats().totalRuns
        }
      },
      timestamp: new Date().toISOString()
    }
  };
};

// Export route modules for individual use if needed
export {
  initializePartnerPortal,
  shutdownPartnerPortal,
  registerPartnerPortalRoutes,
  getPartnerPortalHealth,
  contractRoutes,
  dataRoutes,
  auditRoutes
};
