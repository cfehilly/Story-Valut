# Memento App - Production Deployment Guide

This guide covers deploying the Memento digital time capsule app to production with real OAuth integrations, payment processing, and full functionality.

## 📋 Prerequisites

### Required Accounts & API Keys

1. **Database**: PostgreSQL (Heroku Postgres, AWS RDS, or DigitalOcean)
2. **Redis**: Redis Cloud, AWS ElastiCache, or self-hosted
3. **File Storage**: AWS S3 or DigitalOcean Spaces
4. **Email Service**: SendGrid or AWS SES

### Social Media API Access

#### Twitter API v2
- **Account**: Twitter Developer Account
- **Application Type**: Web App with OAuth 2.0
- **Permissions**: Read tweets, users, and lists
- **Callback URLs**: `https://yourdomain.com/api/auth/twitter/callback`
- **Required**: Consumer Key, Consumer Secret, Bearer Token

#### Facebook/Instagram API
- **Account**: Facebook Developer Account
- **App Type**: Business App
- **Products**: Facebook Login, Instagram Graph API
- **Permissions**: `email`, `user_posts`, `user_photos`, `instagram_basic`
- **Callback URLs**: 
  - Facebook: `https://yourdomain.com/api/auth/facebook/callback`
  - Instagram: `https://yourdomain.com/api/auth/instagram/callback`

#### Google API (YouTube)
- **Account**: Google Cloud Console
- **Project**: Create new project
- **APIs**: YouTube Data API v3, Google OAuth2
- **OAuth Consent Screen**: Configure for external users
- **Scopes**: `profile`, `email`, `youtube.readonly`
- **Callback URL**: `https://yourdomain.com/api/auth/google/callback`

#### Spotify API
- **Account**: Spotify Developer Account
- **App Type**: Web Application
- **Scopes**: `user-read-recently-played`, `playlist-read-private`
- **Redirect URI**: `https://yourdomain.com/api/auth/spotify/callback`

### Payment Processing

#### Stripe Setup
1. **Create Stripe Account**: Business account recommended
2. **Create Products**:
   - Monthly Premium: $4.99/month with 7-day trial
   - Yearly Premium: $39.99/year with 7-day trial
3. **Configure Webhooks**: Point to `https://yourdomain.com/api/webhooks/stripe`
4. **Required Events**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## 🚀 Deployment Options

### Option 1: Heroku (Easiest)

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Create Heroku app
heroku create memento-app

# Add required add-ons
heroku addons:create heroku-postgresql:standard-0
heroku addons:create heroku-redis:premium-0
heroku addons:create sendgrid:starter

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 64)
heroku config:set TWITTER_CONSUMER_KEY=your_twitter_key
heroku config:set FACEBOOK_CLIENT_ID=your_facebook_id
# ... (set all required env vars)

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

### Option 2: DigitalOcean App Platform

```bash
# Create app.yaml
cat > .do/app.yaml << EOF
name: memento-app
services:
- name: api
  source_dir: /
  github:
    repo: your-username/memento-app
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  # Add all environment variables here

databases:
- name: memento-db
  engine: PG
  version: "13"
  
services:
- name: redis
  engine: REDIS
  version: "6"
EOF

# Deploy using doctl
doctl apps create --spec .do/app.yaml
```

### Option 3: AWS (Advanced)

```bash
# Build and push Docker image
docker build -t memento-app .
docker tag memento-app:latest $AWS_ECR_URI/memento-app:latest
docker push $AWS_ECR_URI/memento-app:latest

# Deploy with ECS or Elastic Beanstalk
aws ecs update-service --cluster memento-cluster --service memento-service --force-new-deployment
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Core Configuration
NODE_ENV=production
PORT=3001
CLIENT_URL=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://user:pass@host:6379
JWT_SECRET=your_super_secure_jwt_secret

# Social Media APIs
TWITTER_CONSUMER_KEY=your_twitter_consumer_key
TWITTER_CONSUMER_SECRET=your_twitter_consumer_secret
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Payments
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_MONTHLY_PRICE_ID=price_monthly_id
STRIPE_YEARLY_PRICE_ID=price_yearly_id

# Storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=memento-production-media

# Email
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@yourdomain.com
```

## 📂 Database Setup

### PostgreSQL Schema

```sql
-- Run migrations
npm run migrate

-- Verify tables
\dt

-- Expected tables:
-- users
-- memories
-- capsules
-- capsule_memories
-- knex_migrations
-- knex_migrations_lock
```

### Redis Configuration

Used for:
- Session storage
- Job queues (background processing)
- Rate limiting
- Caching social media API responses

## 🔐 Security Configuration

### SSL/HTTPS
- Use Let's Encrypt or CloudFlare for SSL certificates
- Redirect all HTTP traffic to HTTPS
- Set secure cookie flags

### API Security
```javascript
// Already configured in the app:
// - Helmet for security headers
// - CORS protection
// - Rate limiting
// - Input validation
// - JWT authentication
```

### Environment-specific Settings

```bash
# Production only
HELMET_CSP_ENABLED=true
HELMET_HSTS_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📧 Email Templates

Email notifications are sent for:
- Welcome messages
- Trial reminders
- Payment confirmations
- Capsule unlock notifications
- Account updates

Configure SendGrid templates or use AWS SES.

## 🔄 Background Jobs

Automated tasks include:
- Social media content syncing
- Time capsule unlock checks
- Email notifications
- Data backups
- Analytics processing

## 📊 Monitoring

### Health Checks
```bash
curl https://yourdomain.com/health
# Should return: {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

### Logging
- Application logs: `logs/combined.log`
- Error logs: `logs/error.log`
- Access logs: Handled by hosting platform

### Analytics
- User registration/conversion
- Social platform connection rates
- Subscription metrics
- Feature usage stats

## 🚦 Testing Production

### Pre-deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations run successfully
- [ ] SSL certificate installed
- [ ] Social OAuth flows tested
- [ ] Stripe payments tested (use test mode first)
- [ ] Email notifications working
- [ ] File uploads to S3 working
- [ ] Background jobs running
- [ ] Health check endpoint responding

### Test Scenarios

1. **User Registration**: Email/password signup
2. **Social Login**: OAuth flow for each platform
3. **Memory Import**: Sync from connected accounts
4. **Time Capsule**: Create, schedule, unlock
5. **Subscription**: Trial signup, payment, cancellation
6. **Email Flow**: All notification types
7. **Mobile**: Responsive design on various devices

## 🛠 Maintenance

### Regular Tasks
- Monitor application logs
- Check database performance
- Update dependencies monthly
- Review security alerts
- Monitor API usage limits
- Backup user data

### Scaling
- Monitor memory/CPU usage
- Add more server instances if needed
- Optimize database queries
- Implement CDN for static assets
- Cache frequently accessed data

## 📞 Support

### Error Handling
- All errors logged with Winston
- User-friendly error messages
- Automatic error reporting (configure Sentry)

### Customer Support
- Admin dashboard for user management
- Support ticket system integration
- User activity monitoring
- Data export capabilities

## 🔄 Updates & CI/CD

### GitHub Actions (Recommended)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm test
    - run: npm run build
    - name: Deploy to Heroku
      uses: akhileshns/heroku-deploy@v3.12.12
      with:
        heroku_api_key: ${{secrets.HEROKU_API_KEY}}
        heroku_app_name: "memento-production"
        heroku_email: "your-email@example.com"
```

### Manual Deployment

```bash
# Use the deployment script
chmod +x deploy.sh
DEPLOY_TARGET=heroku ./deploy.sh
```

## 💰 Cost Estimates

### Monthly Operational Costs

- **Hosting**: $25-100 (Heroku Dyno/DigitalOcean Droplet)
- **Database**: $15-50 (PostgreSQL)
- **Redis**: $15-30 (Caching/Jobs)
- **Storage**: $5-25 (AWS S3)
- **Email**: $5-20 (SendGrid)
- **Monitoring**: $0-25 (Basic logging)

**Total**: ~$65-250/month depending on scale

### Revenue Projections
- Free users: Unlimited (with limits)
- Premium: $4.99/month or $39.99/year
- Break-even: ~15-50 paying users depending on costs

---

## 🎉 Go Live Checklist

- [ ] All APIs configured and tested
- [ ] Payment processing live (switch to live keys)
- [ ] Domain configured with SSL
- [ ] Email notifications tested
- [ ] Social media apps approved and live
- [ ] Terms of Service and Privacy Policy published
- [ ] Analytics tracking configured
- [ ] Customer support system ready
- [ ] Marketing site launched
- [ ] App store submissions (if mobile app planned)

Your Memento app is now ready for production! 🚀