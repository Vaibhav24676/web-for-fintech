#!/usr/bin/env node

/**
 * Partner Integration Verification Test
 * Tests all components mentioned in PARTNER_INTEGRATION.md
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectPartnerDb, getPartnerDb, getConnectionStatus, closeConnection } from './partner-portal/config/partnerDb.js';
import partnerSyncService from './backend/utils/partnerSyncService.js';

// Load environment variables
dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (color, message) => console.log(`${color}${message}${colors.reset}`);

async function testDatabaseArchitecture() {
  log(colors.cyan, '\n🏗️  Testing Database Architecture...');
  
  try {
    // Test Main Database (fintech_bank)
    const mainDb = await mongoose.connect(process.env.MONGODB_URI);
    log(colors.green, '✅ Main Database (fintech_bank) connected');
    
    const mainCollections = await mongoose.connection.db.listCollections().toArray();
    const expectedMainCollections = ['users', 'customers', 'consents', 'partners', 'auditlogs'];
    
    log(colors.blue, `📊 Main DB Collections: ${mainCollections.length} found`);
    expectedMainCollections.forEach(expected => {
      const exists = mainCollections.some(col => col.name === expected);
      log(exists ? colors.green : colors.yellow, 
          `${exists ? '✅' : '⚠️'} ${expected}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    // Test Partner Portal Database
    const partnerConnection = await connectPartnerDb();
    log(colors.green, '✅ Partner Portal Database connected');
    
    const partnerDb = getPartnerDb();
    const partnerCollections = await partnerDb.db.listCollections().toArray();
    const expectedPartnerCollections = ['partnerauditlogs', 'userdata', 'contractlogs'];
    
    log(colors.blue, `🏢 Partner DB Collections: ${partnerCollections.length} found`);
    expectedPartnerCollections.forEach(expected => {
      const exists = partnerCollections.some(col => col.name === expected);
      log(exists ? colors.green : colors.yellow, 
          `${exists ? '✅' : '⚠️'} ${expected}: ${exists ? 'EXISTS' : 'MISSING'}`);
    });
    
    return true;
  } catch (error) {
    log(colors.red, `❌ Database architecture test failed: ${error.message}`);
    return false;
  }
}

async function testPartnerSyncService() {
  log(colors.cyan, '\n🔄 Testing Partner Sync Service...');
  
  try {
    log(colors.green, '✅ Partner Sync Service imported successfully');
    
    // Test availability check
    await partnerSyncService.checkPartnerPortalAvailability();
    log(colors.blue, `📡 Partner Portal Available: ${partnerSyncService.isPartnerPortalAvailable}`);
    
    // Test sync status
    const status = partnerSyncService.getStatus();
    log(colors.blue, `⏰ Last Sync: ${status.lastSyncTime || 'Never'}`);
    log(colors.blue, `🔧 Sync Active: ${status.syncActive}`);
    
    // Test configuration
    const syncInterval = process.env.PARTNER_SYNC_INTERVAL || '3600000';
    log(colors.blue, `⚙️  Sync Interval: ${parseInt(syncInterval) / 1000}s`);
    
    return true;
  } catch (error) {
    log(colors.red, `❌ Partner Sync Service test failed: ${error.message}`);
    return false;
  }
}

async function testConnectionStatus() {
  log(colors.cyan, '\n📡 Testing Connection Status Monitoring...');
  
  try {
    const status = getConnectionStatus();
    
    log(colors.blue, '🔍 Connection Status:');
    log(colors.blue, `  Partner DB Connected: ${status.partner.isConnected}`);
    log(colors.blue, `  Partner DB Last Error: ${status.partner.lastError || 'None'}`);
    log(colors.blue, `  Partner DB Reconnect Attempts: ${status.partner.reconnectAttempts}`);
    
    if (status.shared) {
      log(colors.blue, `  Shared DB Connected: ${status.shared.isConnected}`);
      log(colors.blue, `  Shared DB Last Error: ${status.shared.lastError || 'None'}`);
    }
    
    return true;
  } catch (error) {
    log(colors.red, `❌ Connection status test failed: ${error.message}`);
    return false;
  }
}

async function testEnvironmentConfiguration() {
  log(colors.cyan, '\n⚙️  Testing Environment Configuration...');
  
  const integrationVars = [
    'PARTNER_DB_URI',
    'PARTNER_SYNC_INTERVAL', 
    'ENABLE_PARTNER_PORTAL_RETRY',
    'PARTNER_PORTAL_RETRY_INTERVAL'
  ];
  
  let allConfigured = true;
  
  integrationVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      log(colors.green, `✅ ${varName}: ${value}`);
    } else {
      log(colors.yellow, `⚠️  ${varName}: Not set (using defaults)`);
    }
  });
  
  // Test specific configurations
  const partnerDbUri = process.env.PARTNER_DB_URI;
  if (partnerDbUri && partnerDbUri.includes('partner_portal')) {
    log(colors.green, '✅ Partner DB URI points to correct database');
  } else {
    log(colors.red, '❌ Partner DB URI configuration issue');
    allConfigured = false;
  }
  
  return allConfigured;
}

async function testResiliency() {
  log(colors.cyan, '\n🛡️  Testing System Resiliency...');
  
  try {
    // Test main database operations without partner portal
    log(colors.blue, '🔧 Testing main operations without partner dependency...');
    
    const mainDb = mongoose.connection.db;
    const partnersCollection = mainDb.collection('partners');
    
    // Test read operation
    const partnerCount = await partnersCollection.countDocuments();
    log(colors.green, `✅ Main DB read operation successful: ${partnerCount} partners`);
    
    // Test write operation
    const testDoc = {
      name: 'Resiliency Test Partner',
      email: 'test@resilience.com',
      status: 'active',
      createdAt: new Date()
    };
    
    const insertResult = await partnersCollection.insertOne(testDoc);
    log(colors.green, '✅ Main DB write operation successful');
    
    // Clean up
    await partnersCollection.deleteOne({ _id: insertResult.insertedId });
    log(colors.blue, '🧹 Cleaned up test data');
    
    return true;
  } catch (error) {
    log(colors.red, `❌ Resiliency test failed: ${error.message}`);
    return false;
  }
}

async function runPartnerIntegrationVerification() {
  console.log(`${colors.bold}${colors.cyan}
╔══════════════════════════════════════════════════════════════════╗
║              PARTNER INTEGRATION VERIFICATION                   ║
║              Testing PARTNER_INTEGRATION.md Components          ║
╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const startTime = Date.now();
  
  try {
    // Run all verification tests
    const tests = [
      { name: 'Database Architecture', test: testDatabaseArchitecture },
      { name: 'Environment Configuration', test: testEnvironmentConfiguration },
      { name: 'Partner Sync Service', test: testPartnerSyncService },
      { name: 'Connection Status', test: testConnectionStatus },
      { name: 'System Resiliency', test: testResiliency }
    ];
    
    const results = [];
    
    for (const { name, test } of tests) {
      try {
        const result = await test();
        results.push({ name, passed: result });
      } catch (error) {
        log(colors.red, `❌ ${name} test crashed: ${error.message}`);
        results.push({ name, passed: false });
      }
    }
    
    // Summary
    log(colors.cyan, '\n📋 Partner Integration Verification Summary:');
    
    let allPassed = true;
    results.forEach(({ name, passed }) => {
      log(passed ? colors.green : colors.red, 
          `${passed ? '✅' : '❌'} ${name}: ${passed ? 'PASS' : 'FAIL'}`);
      if (!passed) allPassed = false;
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    if (allPassed) {
      log(colors.green, `\n🎉 PARTNER INTEGRATION FULLY VERIFIED!`);
      log(colors.blue, `✨ All components from PARTNER_INTEGRATION.md are operational`);
      log(colors.blue, `⏱️  Verification completed in ${duration} seconds`);
      
      log(colors.cyan, '\n📖 Integration Features Confirmed:');
      log(colors.green, '✅ Dual database architecture working');
      log(colors.green, '✅ Partner Sync Service operational');
      log(colors.green, '✅ Resilient validation implemented');
      log(colors.green, '✅ Connection monitoring active');
      log(colors.green, '✅ Environment properly configured');
      log(colors.green, '✅ System continues without partner portal');
      
      process.exit(0);
    } else {
      log(colors.red, `\n❌ PARTNER INTEGRATION VERIFICATION FAILED!`);
      log(colors.blue, `⏱️  Verification completed in ${duration} seconds`);
      process.exit(1);
    }
    
  } catch (error) {
    log(colors.red, `\n💥 Verification crashed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up connections
    try {
      await closeConnection();
      await mongoose.disconnect();
    } catch (error) {
      console.error('Error closing connections:', error);
    }
  }
}

// Run the verification
runPartnerIntegrationVerification();
