#!/usr/bin/env node

/**
 * Fix Admin User Script - Using Proper User Model
 * Removes old admin users and creates a fresh admin with correct role
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './backend/models/userModel.js';

// Load environment variables
dotenv.config();

async function fixAdminUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintech_bank');
    console.log('✅ Connected to MongoDB');

    // Find and display existing admin-like users
    const existingUsers = await User.find({
      $or: [
        { email: 'admin@fintechbank.com' },
        { username: 'admin' },
        { role: 'admin' }
      ]
    });

    console.log(`Found ${existingUsers.length} users with admin credentials:`);
    existingUsers.forEach(user => {
      console.log(`  - ID: ${user._id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
    });

    // Remove all existing admin users
    console.log('🗑️ Removing existing admin users...');
    await User.deleteMany({
      $or: [
        { email: 'admin@fintechbank.com' },
        { username: 'admin' },
        { role: 'admin' }
      ]
    });
    console.log('✅ Removed existing admin users');

    // Create fresh admin user
    console.log('👤 Creating fresh admin user...');
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@fintechbank.com',
      password: 'Admin123!@#',
      role: 'admin'
    });

    console.log(`✅ Created admin user: ${adminUser.username} (${adminUser.email}) with role: ${adminUser.role}`);

    // Verify the user was created correctly
    const verifyUser = await User.findById(adminUser._id);
    console.log('✅ Verification:');
    console.log(`   ID: ${verifyUser._id}`);
    console.log(`   Username: ${verifyUser.username}`);
    console.log(`   Email: ${verifyUser.email}`);
    console.log(`   Role: ${verifyUser.role}`);

    console.log('🎉 Admin user fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing admin user:', error);
    process.exit(1);
  } finally {
    console.log('🔌 Disconnected from MongoDB');
    await mongoose.disconnect();
  }
}

// Run the script
fixAdminUser();
