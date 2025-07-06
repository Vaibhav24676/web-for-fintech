#!/usr/bin/env node

/**
 * Create Admin User Script
 * Creates an admin user for testing purposes
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple User schema for admin creation
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  role: {
    type: String,
    enum: ['admin', 'partner', 'customer'],
    default: 'customer'
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

async function createAdminUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintech_bank');
    console.log('✅ Connected to MongoDB');

    const adminData = {
      username: 'admin',
      email: 'admin@fintechbank.com',
      password: 'Admin123!@#',
      role: 'admin'
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: adminData.email },
        { username: adminData.username }
      ]
    });

    if (existingAdmin) {
      console.log('⚠️ Admin user already exists. Updating role to admin...');
      existingAdmin.role = 'admin';
      await existingAdmin.save();
      console.log(`✅ Updated user ${existingAdmin.username} to admin role`);
    } else {
      console.log('👤 Creating new admin user...');
      const adminUser = await User.create(adminData);
      console.log(`✅ Created admin user: ${adminUser.username} (${adminUser.email})`);
    }

    console.log('\n🎉 Admin user setup complete!');
    console.log('\n📝 Admin Credentials:');
    console.log(`   Username: ${adminData.username}`);
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('\n🔐 You can now login using these credentials.');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === 11000) {
      console.log('💡 Admin user might already exist. Try logging in with existing credentials.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdminUser();
