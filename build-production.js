#!/usr/bin/env node

/**
 * Production Build Script for Story Vault App
 * 
 * This script prepares the application for production deployment by:
 * - Validating environment variables
 * - Running database migrations
 * - Building client assets
 * - Creating optimized bundles
 * - Validating all services
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

console.log('🚀 Starting Story Vault production build...\n');

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logError = (message) => log(`❌ ${message}`, 'red');
const logSuccess = (message) => log(`✅ ${message}`, 'green');
const logWarning = (message) => log(`⚠️  ${message}`, 'yellow');
const logInfo = (message) => log(`ℹ️  ${message}`, 'blue');

// Step 1: Validate environment variables
function validateEnvironment() {
  log('\n📋 Validating environment configuration...', 'bold');
  
  const requiredVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'DATABASE_URL'
  ];

  const recommendedVars = [
    'STRIPE_SECRET_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'SENDGRID_API_KEY'
  ];

  let hasErrors = false;

  // Check required variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      logError(`Missing required environment variable: ${varName}`);
      hasErrors = true;
    } else {
      logSuccess(`${varName} is configured`);
    }
  });

  // Check recommended variables
  recommendedVars.forEach(varName => {
    if (!process.env[varName]) {
      logWarning(`Missing recommended environment variable: ${varName}`);
    } else {
      logSuccess(`${varName} is configured`);
    }
  });

  // Validate specific values
  if (process.env.NODE_ENV !== 'production') {
    logError('NODE_ENV must be set to "production" for production builds');
    hasErrors = true;
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    logError('JWT_SECRET should be at least 32 characters long');
    hasErrors = true;
  }

  if (hasErrors) {
    logError('Environment validation failed. Please fix the above errors.');
    process.exit(1);
  }

  logSuccess('Environment validation passed');
}

// Step 2: Install dependencies
function installDependencies() {
  log('\n📦 Installing production dependencies...', 'bold');
  
  try {
    execSync('npm ci --only=production', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    logSuccess('Dependencies installed');
  } catch (error) {
    logError('Failed to install dependencies');
    throw error;
  }
}

// Step 3: Run database migrations
function runMigrations() {
  log('\n🗄️  Running database migrations...', 'bold');
  
  try {
    execSync('npx knex migrate:latest', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    logSuccess('Database migrations completed');
  } catch (error) {
    logError('Database migration failed');
    throw error;
  }
}

// Step 4: Build client assets
function buildClientAssets() {
  log('\n🎨 Building client assets...', 'bold');
  
  try {
    // Create optimized versions of HTML files
    const htmlFiles = ['redesigned-app.html', 'memento.html', 'premium-app.html'];
    
    htmlFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        
        // Minify HTML (basic)
        const minified = content
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim();
        
        const outputFile = file.replace('.html', '.min.html');
        fs.writeFileSync(outputFile, minified);
        logInfo(`Minified ${file} -> ${outputFile}`);
      }
    });

    logSuccess('Client assets built');
  } catch (error) {
    logError('Failed to build client assets');
    throw error;
  }
}

// Step 5: Create production configuration
function createProductionConfig() {
  log('\n⚙️  Creating production configuration...', 'bold');
  
  const prodConfig = {
    name: 'storyvault-app',
    script: 'server/index.js',
    instances: process.env.PM2_INSTANCES || 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  };

  // Ensure logs directory exists
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
  }

  // Write PM2 ecosystem file
  fs.writeFileSync('ecosystem.config.js', `module.exports = {
  apps: [${JSON.stringify(prodConfig, null, 2)}]
};`);

  logSuccess('Production configuration created');
}

// Step 6: Validate services
async function validateServices() {
  log('\n🔍 Validating services...', 'bold');
  
  try {
    // Test database connection
    const { initializeDatabase } = require('./server/services/database');
    await initializeDatabase();
    logSuccess('Database connection validated');

    // Test Redis connection (optional)
    try {
      const { initializeRedis } = require('./server/services/redis');
      await initializeRedis();
      logSuccess('Redis connection validated');
    } catch (error) {
      logWarning('Redis connection failed (optional service)');
    }

    // Test storage services
    try {
      const { initializeStorage } = require('./server/services/storage');
      await initializeStorage();
      logSuccess('Storage services validated');
    } catch (error) {
      logWarning('Storage service validation failed (will use local storage)');
    }

    logSuccess('Service validation completed');
  } catch (error) {
    logError('Service validation failed');
    throw error;
  }
}

// Step 7: Security checks
function runSecurityChecks() {
  log('\n🔐 Running security checks...', 'bold');
  
  try {
    // Check for npm vulnerabilities
    execSync('npm audit --audit-level=high', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    logSuccess('Security audit passed');
  } catch (error) {
    logWarning('Security audit found issues - review carefully');
  }

  // Check file permissions
  const sensitiveFiles = ['.env', 'ecosystem.config.js'];
  sensitiveFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      if ((stats.mode & parseInt('077', 8)) !== 0) {
        logWarning(`${file} has overly permissive permissions`);
      } else {
        logSuccess(`${file} permissions OK`);
      }
    }
  });
}

// Step 8: Create deployment package
function createDeploymentPackage() {
  log('\n📦 Creating deployment package...', 'bold');
  
  const deploymentFiles = [
    'server/',
    'redesigned-app.html',
    'redesigned-styles.css',
    'redesigned-app.js',
    'package.json',
    'package-lock.json',
    'ecosystem.config.js',
    'knexfile.js',
    '.env.example',
    'DEPLOYMENT.md',
    'README.md'
  ];

  // Create deployment info
  const deploymentInfo = {
    buildDate: new Date().toISOString(),
    version: require('./package.json').version,
    nodeVersion: process.version,
    buildEnvironment: process.env.NODE_ENV,
    files: deploymentFiles.filter(file => fs.existsSync(file))
  };

  fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2));
  
  logSuccess('Deployment package ready');
  logInfo(`Build completed at: ${deploymentInfo.buildDate}`);
}

// Main build function
async function build() {
  try {
    const startTime = Date.now();
    
    validateEnvironment();
    installDependencies();
    runMigrations();
    buildClientAssets();
    createProductionConfig();
    await validateServices();
    runSecurityChecks();
    createDeploymentPackage();

    const buildTime = Math.round((Date.now() - startTime) / 1000);
    
    log('\n🎉 Production build completed successfully!', 'bold');
    log(`Total build time: ${buildTime} seconds`, 'green');
    
    log('\n📋 Next steps:', 'bold');
    log('1. Review deployment-info.json for build details');
    log('2. Upload files to your production server');
    log('3. Set up environment variables on production');
    log('4. Run: pm2 start ecosystem.config.js');
    log('5. Configure reverse proxy (nginx/apache)');
    log('6. Set up SSL certificates');
    log('7. Configure monitoring and logging');
    
  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle CLI arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Story Vault Production Build Script

Usage: node build-production.js [options]

Options:
  --help, -h     Show this help message
  --skip-deps    Skip dependency installation
  --skip-db      Skip database migrations
  --skip-assets  Skip asset building

Environment Variables:
  NODE_ENV          Must be 'production'
  DATABASE_URL      PostgreSQL connection string
  JWT_SECRET        Secret for JWT tokens (32+ chars)
  
Optional but recommended:
  STRIPE_SECRET_KEY   For payment processing
  AWS_ACCESS_KEY_ID   For cloud storage
  SENDGRID_API_KEY    For email notifications
`);
    process.exit(0);
  }

  build().catch(error => {
    logError('Unexpected error during build:');
    console.error(error);
    process.exit(1);
  });
}

module.exports = { build };