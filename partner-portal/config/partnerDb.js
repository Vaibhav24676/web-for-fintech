import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection for Partner Portal Database (SECONDARY)
let partnerConnection = null;

// Connection for Shared Database (PRIMARY - read-only access)
let sharedConnection = null;

// Track connection states
let partnerConnectionState = {
  isConnected: false,
  lastError: null,
  lastConnectAttempt: null,
  reconnectAttempts: 0
};

let sharedConnectionState = {
  isConnected: false,
  lastError: null,
  lastConnectAttempt: null,
  reconnectAttempts: 0
};

/**
 * Connect to the Partner Portal database
 * @returns {Promise<mongoose.Connection>} The database connection
 */
const connectPartnerDb = async () => {
  try {
    partnerConnectionState.lastConnectAttempt = new Date();
    
    if (!partnerConnection) {
      const uri = process.env.PARTNER_DB_URI;
      if (!uri) {
        throw new Error('PARTNER_DB_URI environment variable not set');
      }
      
      console.log('🔄 Connecting to Partner Portal Database...');
      
      partnerConnection = await mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      });
      
      partnerConnection.on('connected', () => {
        console.log('✅ Connected to Partner Portal Database');
        partnerConnectionState.isConnected = true;
        partnerConnectionState.lastError = null;
        partnerConnectionState.reconnectAttempts = 0;
      });
      
      partnerConnection.on('error', (err) => {
        console.error('❌ Partner DB connection error:', err);
        partnerConnectionState.lastError = err.message;
      });
      
      partnerConnection.on('disconnected', () => {
        console.log('⚠️ Partner DB disconnected');
        partnerConnectionState.isConnected = false;
        
        // Auto-reconnect if configured
        if (process.env.ENABLE_PARTNER_DB_AUTO_RECONNECT === 'true') {
          const maxRetries = parseInt(process.env.PARTNER_DB_MAX_RECONNECT_ATTEMPTS || '10');
          const retryInterval = parseInt(process.env.PARTNER_DB_RECONNECT_INTERVAL_MS || '30000');
          
          if (partnerConnectionState.reconnectAttempts < maxRetries) {
            partnerConnectionState.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect to Partner DB (Attempt ${partnerConnectionState.reconnectAttempts}/${maxRetries})...`);
            
            setTimeout(() => {
              connectPartnerDb().catch(err => {
                console.error('❌ Partner DB reconnection failed:', err);
              });
            }, retryInterval);
          } else {
            console.error(`❌ Failed to reconnect to Partner DB after ${maxRetries} attempts`);
          }
        }
      });

      // Force connection to ensure we're actually connected before returning
      await partnerConnection.asPromise();
      
      // Explicitly set the connected state
      partnerConnectionState.isConnected = true;
      console.log('✅ Connected to Partner Portal Database');
    }
    
    return partnerConnection;
  } catch (error) {
    console.error('Failed to connect to Partner Portal Database:', error);
    partnerConnectionState.lastError = error.message;
    partnerConnectionState.isConnected = false;
    throw error;
  }
};

/**
 * Connect to the Shared (Main) database
 * @returns {Promise<mongoose.Connection>} The database connection
 */
const connectSharedDb = async () => {
  try {
    sharedConnectionState.lastConnectAttempt = new Date();
    
    if (!sharedConnection) {
      const uri = process.env.MONGODB_URI;
      if (!uri) {
        throw new Error('MONGODB_URI environment variable not set');
      }
      
      console.log('🔄 Connecting to Shared Database...');
      
      sharedConnection = await mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      });
      
      sharedConnection.on('connected', () => {
        console.log('✅ Connected to Shared Database');
        sharedConnectionState.isConnected = true;
        sharedConnectionState.lastError = null;
        sharedConnectionState.reconnectAttempts = 0;
      });
      
      sharedConnection.on('error', (err) => {
        console.error('❌ Shared DB connection error:', err);
        sharedConnectionState.lastError = err.message;
      });
      
      sharedConnection.on('disconnected', () => {
        console.log('⚠️ Shared DB disconnected');
        sharedConnectionState.isConnected = false;
        
        // Auto-reconnect if configured
        if (process.env.ENABLE_SHARED_DB_AUTO_RECONNECT === 'true') {
          const maxRetries = parseInt(process.env.SHARED_DB_MAX_RECONNECT_ATTEMPTS || '10');
          const retryInterval = parseInt(process.env.SHARED_DB_RECONNECT_INTERVAL_MS || '30000');
          
          if (sharedConnectionState.reconnectAttempts < maxRetries) {
            sharedConnectionState.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect to Shared DB (Attempt ${sharedConnectionState.reconnectAttempts}/${maxRetries})...`);
            
            setTimeout(() => {
              connectSharedDb().catch(err => {
                console.error('❌ Shared DB reconnection failed:', err);
              });
            }, retryInterval);
          } else {
            console.error(`❌ Failed to reconnect to Shared DB after ${maxRetries} attempts`);
          }
        }
      });
    }
    
    return sharedConnection;
  } catch (error) {
    console.error('Failed to connect to Shared Database:', error);
    sharedConnectionState.lastError = error.message;
    sharedConnectionState.isConnected = false;
    throw error;
  }
};

/**
 * Get the Partner Portal database connection
 * @returns {mongoose.Connection} The database connection with db property for MongoDB access
 * @throws {Error} If the connection is not established
 */
const getPartnerDb = () => {
  if (!partnerConnection || !partnerConnectionState.isConnected) {
    throw new Error('Partner database not connected. Call connectPartnerDb() first.');
  }
  
  // For backward compatibility with existing code
  partnerConnection.db = partnerConnection.db || partnerConnection.getClient().db();
  
  return partnerConnection;
};

/**
 * Get the Shared database connection
 * @returns {mongoose.Connection} The database connection
 * @throws {Error} If the connection is not established
 */
const getSharedDb = () => {
  if (!sharedConnection || !sharedConnectionState.isConnected) {
    throw new Error('Shared database not connected. Call connectSharedDb() first.');
  }
  return sharedConnection;
};

/**
 * Get connection status of both databases
 * @returns {Object} Connection status information
 */
const getConnectionStatus = () => {
  return {
    partner: {
      isConnected: partnerConnectionState.isConnected,
      lastError: partnerConnectionState.lastError,
      lastConnectAttempt: partnerConnectionState.lastConnectAttempt,
      reconnectAttempts: partnerConnectionState.reconnectAttempts
    },
    shared: {
      isConnected: sharedConnectionState.isConnected,
      lastError: sharedConnectionState.lastError,
      lastConnectAttempt: sharedConnectionState.lastConnectAttempt,
      reconnectAttempts: sharedConnectionState.reconnectAttempts
    }
  };
};

/**
 * Reset connection states and force reconnection
 */
const resetConnections = async () => {
  if (partnerConnection) {
    await partnerConnection.close();
    partnerConnection = null;
    partnerConnectionState.isConnected = false;
    partnerConnectionState.reconnectAttempts = 0;
  }
  
  if (sharedConnection) {
    await sharedConnection.close();
    sharedConnection = null;
    sharedConnectionState.isConnected = false;
    sharedConnectionState.reconnectAttempts = 0;
  }
};

/**
 * Close all database connections
 * @returns {Promise<void>} Promise that resolves when connections are closed
 */
const closeConnection = async () => {
  try {
    if (partnerConnection) {
      await partnerConnection.close();
      partnerConnection = null;
      partnerConnectionState.isConnected = false;
      console.log('✅ Partner Portal Database connection closed');
    }
    
    if (sharedConnection) {
      await sharedConnection.close();
      sharedConnection = null;
      sharedConnectionState.isConnected = false;
      console.log('✅ Shared Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
    throw error;
  }
};

export {
  connectPartnerDb,
  connectSharedDb,
  getPartnerDb,
  getSharedDb,
  getConnectionStatus,
  resetConnections,
  closeConnection
};
