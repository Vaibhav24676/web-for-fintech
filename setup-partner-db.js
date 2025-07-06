// Partner Portal database setup script
// This script creates the Partner Portal database and necessary collections

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Partner Portal database URI
const PARTNER_DB_URI = process.env.PARTNER_DB_URI || 'mongodb://localhost:27017/partner_portal';

async function setupPartnerPortalDatabase() {
  console.log('Setting up Partner Portal database...');
  
  let client;
  try {
    // Connect to MongoDB
    client = new MongoClient(PARTNER_DB_URI);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    // Access partner_portal database
    const db = client.db();
    console.log(`Using database: ${db.databaseName}`);
    
    // Create collections if they don't exist
    const collections = [
      'contractlogs',
      'partnerauditlogs',
      'userdata'
    ];
    
    const existingCollections = await db.listCollections().toArray();
    const existingCollectionNames = existingCollections.map(c => c.name);
    
    for (const collectionName of collections) {
      if (!existingCollectionNames.includes(collectionName)) {
        await db.createCollection(collectionName);
        console.log(`Created collection: ${collectionName}`);
      } else {
        console.log(`Collection already exists: ${collectionName}`);
      }
    }
    
    // Create sample data for contracts collection
    const contractsCollection = db.collection('contractlogs');
    const contractCount = await contractsCollection.countDocuments();
    
    if (contractCount === 0) {
      console.log('Creating sample contract data...');
      
      const sampleContracts = [
        {
          partner_id: 'partner1',
          consent_id: 'contract123',
          status: 'ACTIVE',
          signed_at: new Date(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          allowed_data_fields: ['name', 'email', 'account_balance'],
          contract_purpose: 'Financial advisory services',
          retention_period_days: 90,
          metadata: new Map([
            ['partner_name', 'Financial Advisor Inc.'],
            ['contract_version', '1.0'],
            ['security_level', 'high']
          ])
        },
        {
          partner_id: 'partner2',
          consent_id: 'contract456',
          status: 'ACTIVE',
          signed_at: new Date(),
          expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          allowed_data_fields: ['name', 'transaction_history'],
          contract_purpose: 'Payment processing',
          retention_period_days: 30,
          metadata: new Map([
            ['partner_name', 'Payment Gateway LLC'],
            ['contract_version', '2.1'],
            ['security_level', 'medium']
          ])
        },
        {
          partner_id: 'partner3',
          consent_id: 'contract789',
          status: 'PENDING',
          signed_at: null,
          expires_at: null,
          allowed_data_fields: ['name', 'email'],
          contract_purpose: 'Marketing communications',
          retention_period_days: 180,
          metadata: new Map([
            ['partner_name', 'Marketing Solutions Co.'],
            ['contract_version', '1.5'],
            ['security_level', 'low']
          ])
        }
      ];
      
      await contractsCollection.insertMany(sampleContracts);
      console.log(`Inserted ${sampleContracts.length} sample contracts`);
    } else {
      console.log(`Found ${contractCount} existing contracts, skipping sample data creation`);
    }
    
    // Create indexes for better performance
    console.log('Creating indexes...');
    await contractsCollection.createIndex({ partner_id: 1 });
    await contractsCollection.createIndex({ status: 1 });
    await contractsCollection.createIndex({ expires_at: 1 });
    
    const auditCollection = db.collection('partnerauditlogs');
    await auditCollection.createIndex({ timestamp: 1 });
    await auditCollection.createIndex({ partner_id: 1 });
    
    const userDataCollection = db.collection('userdata');
    await userDataCollection.createIndex({ partner_id: 1 });
    await userDataCollection.createIndex({ expires_at: 1 });
    
    console.log('Partner Portal database setup completed successfully!');
    
    return {
      success: true,
      database: db.databaseName,
      collections: collections,
      uri: PARTNER_DB_URI.replace(/:([^:@]+)@/, ':****@')
    };
  } catch (error) {
    console.error('Error setting up Partner Portal database:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the setup function
setupPartnerPortalDatabase()
  .then(result => {
    console.log('\nSetup Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\nNext steps:');
      console.log('1. Make sure your .env file has PARTNER_DB_URI set to:', result.uri);
      console.log('2. Run the test-database-integration.js script to verify both databases');
      console.log('3. Start the fintech backend server with "node backend/server.js"');
    } else {
      console.log('\nSetup failed. Please check the error message and try again.');
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error during setup:', err);
    process.exit(1);
  });
