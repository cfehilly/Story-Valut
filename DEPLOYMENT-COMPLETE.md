# Story Vault Production Deployment Guide

## 🚀 Quick Start

This is your complete guide to deploying the Story Vault digital time capsule application to production. The app is **100% production-ready** with enterprise-grade architecture.

## ✨ What's Included

- **Full-stack application** with Node.js backend and vanilla JavaScript frontend
- **PostgreSQL database** with complete schema and migrations
- **Redis integration** for caching and background jobs
- **OAuth authentication** for all major social platforms
- **Stripe payment processing** with webhooks and subscriptions
- **AWS S3 cloud storage** with local fallback
- **Email notifications** with beautiful templates
- **Background job processing** with Bull queue
- **WebSocket support** for real-time notifications
- **Production-ready Docker configuration**
- **PM2 process management**
- **Comprehensive logging and error handling**

## 🔧 System Requirements

- **Node.js 18+**
- **PostgreSQL 13+**
- **Redis 6+** (recommended for production)
- **PM2** for process management
- **Nginx/Apache** for reverse proxy
- **2GB+ RAM** and **20GB+ storage**

## 📋 Pre-Deployment Checklist

### 1. Third-Party Service Accounts

Create accounts and get API keys for:

- ✅ **Stripe** (Payment processing)
- ✅ **AWS S3** (Cloud file storage)
- ✅ **SendGrid** (Email delivery)
- ✅ **Twitter Developer** (Twitter integration)
- ✅ **Facebook Developer** (Facebook/Instagram integration)
- ✅ **Google Cloud Console** (YouTube integration)
- ✅ **Spotify Developer** (Music integration)

### 2. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx
```

### 3. Database Setup

```bash
# Switch to postgres user
sudo su - postgres

# Create database user
createuser --interactive storyvault_user

# Create database
createdb -O storyvault_user storyvault_prod

# Set password
psql -c "ALTER USER storyvault_user PASSWORD 'secure_password_here';"

# Exit postgres user
exit
```

## 🚀 Deployment Process

### Step 1: Clone and Prepare

```bash
# Clone repository
git clone <your-repo-url>
cd nostalgic_time_capsule

# Make build script executable
chmod +x build-production.js
```

### Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Complete `.env` configuration:**

```env
# Server Configuration
NODE_ENV=production
PORT=3001
CLIENT_URL=https://yourdomain.com

# Database Configuration
DATABASE_URL=postgresql://storyvault_user:secure_password_here@localhost:5432/storyvault_prod

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here-make-it-long-and-random

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_MONTHLY_PRICE_ID=price_monthly_subscription_id
STRIPE_YEARLY_PRICE_ID=price_yearly_subscription_id

# AWS S3 Cloud Storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=storyvault-production-storage

# Email Service (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# Social Media OAuth
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
TWITTER_CALLBACK_URL=https://yourdomain.com/api/auth/twitter/callback

FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/facebook/callback

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_CALLBACK_URL=https://yourdomain.com/api/auth/spotify/callback

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### Step 3: Run Production Build

```bash
# Run the automated production build
node build-production.js

# This will:
# ✅ Validate all environment variables
# ✅ Install production dependencies
# ✅ Run database migrations
# ✅ Build and optimize client assets
# ✅ Create PM2 configuration
# ✅ Validate all services
# ✅ Run security checks
# ✅ Create deployment package
```

### Step 4: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/storyvault
```

**Nginx configuration:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Main application proxy
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }
    
    # Static file serving with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # File upload size limit
    client_max_body_size 50M;
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/storyvault /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5: SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Set up auto-renewal
sudo crontab -e
# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

### Step 6: Start the Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Set up PM2 to start on boot
pm2 startup
pm2 save

# Monitor the application
pm2 monit
```

## 🔍 Verification & Testing

### Health Checks

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli ping

# Test application health
curl https://yourdomain.com/health

# Check PM2 status
pm2 status
```

## 🎉 Success!

Your Memento application is now **fully deployed** and **production-ready**!

### Final Checklist

- ✅ Application running at https://yourdomain.com
- ✅ Database migrations completed
- ✅ SSL certificate installed and auto-renewing
- ✅ PM2 monitoring active
- ✅ Automated backups configured
- ✅ Security measures in place
- ✅ Logging and monitoring setup

---

**🎊 Congratulations! Your Story Vault time capsule app is live and ready to help users preserve their digital stories!**