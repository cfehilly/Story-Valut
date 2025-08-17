// PM2 ecosystem configuration for production deployment
module.exports = {
  apps: [
    {
      name: 'storyvault-app',
      script: './server/index.js',
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      max_memory_restart: '500M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'public/uploads'],
      
      // Advanced features
      autorestart: true,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Source map support for better error tracking
      source_map_support: true,
      
      // Instance variables for load balancing
      instance_var: 'INSTANCE_ID'
    },
    
    // Background jobs processor
    {
      name: 'storyvault-jobs',
      script: './server/jobs/processor.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'jobs'
      },
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'jobs'
      },
      
      log_file: './logs/jobs.log',
      out_file: './logs/jobs-out.log',
      error_file: './logs/jobs-error.log',
      
      autorestart: true,
      max_memory_restart: '200M',
      restart_delay: 5000,
      max_restarts: 5
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-username/storyvault-app.git',
      path: '/var/www/storyvault',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "This is a local command executed before deploy"',
      'post-deploy-local': 'echo "Local command executed after deploy"',
      env: {
        NODE_ENV: 'production'
      }
    },
    
    staging: {
      user: 'deploy',
      host: 'staging.example.com',
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/storyvault-app.git',
      path: '/var/www/storyvault-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};