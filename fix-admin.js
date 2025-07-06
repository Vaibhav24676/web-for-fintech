#!/usr/bin/env node

/**
 * Fix Admin User Script
 * Removes old customer admin and ensures proper admin exists
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 8 },
  role: { type: String, enum: ['admin', 'partner', 'customer'], default: 'customer' }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

async function fixAdminUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fintech_bank');
    console.log('✅ Connected to MongoDB');

    // Find all users with admin credentials
    const adminUsers = await User.find({ 
      $or: [
        { email: 'admin@fintechbank.com' },
        { username: 'admin' }
      ]
    });

    console.log(`Found ${adminUsers.length} users with admin credentials:`);
    adminUsers.forEach(user => {
      console.log(`  - ID: ${user._id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
    });

    // Remove all existing admin users
    if (adminUsers.length > 0) {
      console.log('\n🗑️ Removing existing admin users...');
      await User.deleteMany({ 
        $or: [
          { email: 'admin@fintechbank.com' },
          { username: 'admin' }
        ]
      });
      console.log('✅ Removed existing admin users');
    }

    // Create fresh admin user
    console.log('\n👤 Creating fresh admin user...');
    const adminData = {
      username: 'admin',
      email: 'admin@fintechbank.com',
      password: 'Admin123!@#',
      role: 'admin'
    };

    const adminUser = await User.create(adminData);
    console.log(`✅ Created admin user: ${adminUser.username} (${adminUser.email}) with role: ${adminUser.role}`);

    // Verify the user
    const verifyUser = await User.findById(adminUser._id);
    console.log('\n✅ Verification:');
    console.log(`   ID: ${verifyUser._id}`);
    console.log(`   Username: ${verifyUser.username}`);
    console.log(`   Email: ${verifyUser.email}`);
    console.log(`   Role: ${verifyUser.role}`);

    console.log('\n🎉 Admin user fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing admin user:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixAdminUser();
