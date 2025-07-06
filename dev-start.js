#!/usr/bin/env node

/**
 * Development Helper Script
 * Helps start the server with proper environment setup
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const __dirname = process.cwd();

console.log('🚀 Fintech Backend Development Helper\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envTestPath = path.join(__dirname, '.env.test');

if (!fs.existsSync(envPath)) {
  console.log('⚠️ No .env file found. Creating from template...');
  
  if (fs.existsSync(envTestPath)) {
    fs.copyFileSync(envTestPath, envPath);
    console.log('✅ Created .env from .env.test template');
    console.log('📝 Please review and update the environment variables in .env');
  } else {
    console.log('❌ No .env.test template found. Please create .env manually.');
    process.exit(1);
  }
}

// Check if dependencies are installed
const backendNodeModules = path.join(__dirname, 'backend', 'node_modules');
const partnerPortalNodeModules = path.join(__dirname, 'partner-portal', 'node_modules');

if (!fs.existsSync(backendNodeModules)) {
  console.log('📦 Installing backend dependencies...');
  const backendInstall = spawn('npm', ['install'], { 
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    backendInstall.on('close', resolve);
  });
}

if (!fs.existsSync(partnerPortalNodeModules)) {
  console.log('📦 Installing partner-portal dependencies...');
  const partnerInstall = spawn('npm', ['install'], { 
    cwd: path.join(__dirname, 'partner-portal'),
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve) => {
    partnerInstall.on('close', resolve);
  });
}

console.log('\n✅ Environment setup complete!');
console.log('\n🌟 Available commands:');
console.log('  npm start          - Start production server');
console.log('  npm run dev        - Start development server with nodemon');
console.log('  node test-api.js   - Run comprehensive API tests');
console.log('  node test-modules.js - Test module imports');
console.log('\n📚 Documentation:');
console.log('  TESTING_GUIDE.md   - Manual testing instructions');
console.log('  PARTNER_PORTAL_README.md - Partner Portal documentation');

console.log('\n🚀 Starting development server...\n');

// Start the development server
const server = spawn('npm', ['run', 'dev'], { 
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  server.kill('SIGTERM');
  process.exit(0);
});
