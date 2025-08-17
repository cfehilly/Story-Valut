#!/bin/bash

# Memento Deployment Script
# This script handles production deployment to various platforms

set -e

echo "🚀 Starting Memento deployment..."

# Check environment
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
fi

echo "Environment: $NODE_ENV"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate

# Build frontend assets
echo "🔨 Building frontend assets..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

# Security checks
echo "🔒 Running security audit..."
npm audit --audit-level high

# Deploy to different platforms based on target
case "${DEPLOY_TARGET:-heroku}" in
    "heroku")
        echo "🌐 Deploying to Heroku..."
        
        # Install Heroku CLI if not present
        if ! command -v heroku &> /dev/null; then
            echo "Installing Heroku CLI..."
            curl https://cli-assets.heroku.com/install.sh | sh
        fi
        
        # Deploy to Heroku
        git add .
        git commit -m "Deploy $(date)" || true
        git push heroku main
        
        # Set environment variables
        heroku config:set NODE_ENV=production
        heroku config:set NPM_CONFIG_PRODUCTION=false
        
        # Run migrations on Heroku
        heroku run npm run migrate
        
        echo "✅ Deployed to Heroku successfully!"
        echo "App URL: $(heroku apps:info --json | jq -r '.app.web_url')"
        ;;
        
    "vercel")
        echo "🌐 Deploying to Vercel..."
        
        # Install Vercel CLI if not present
        if ! command -v vercel &> /dev/null; then
            npm install -g vercel
        fi
        
        # Deploy to Vercel
        vercel --prod
        
        echo "✅ Deployed to Vercel successfully!"
        ;;
        
    "aws")
        echo "🌐 Deploying to AWS..."
        
        # Build Docker image
        docker build -t memento-app .
        
        # Tag and push to ECR
        aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ECR_URI
        docker tag memento-app:latest $AWS_ECR_URI/memento-app:latest
        docker push $AWS_ECR_URI/memento-app:latest
        
        # Update ECS service
        aws ecs update-service --cluster memento-cluster --service memento-service --force-new-deployment
        
        echo "✅ Deployed to AWS successfully!"
        ;;
        
    "digitalocean")
        echo "🌐 Deploying to DigitalOcean..."
        
        # Deploy using Docker
        docker build -t memento-app .
        docker tag memento-app registry.digitalocean.com/memento/memento-app
        docker push registry.digitalocean.com/memento/memento-app
        
        echo "✅ Deployed to DigitalOcean successfully!"
        ;;
        
    "pm2")
        echo "🌐 Deploying with PM2..."
        
        # Stop existing processes
        pm2 stop memento || true
        pm2 delete memento || true
        
        # Start with PM2
        pm2 start ecosystem.config.js --env production
        pm2 save
        
        echo "✅ Deployed with PM2 successfully!"
        ;;
        
    *)
        echo "❌ Unknown deployment target: $DEPLOY_TARGET"
        echo "Supported targets: heroku, vercel, aws, digitalocean, pm2"
        exit 1
        ;;
esac

# Health check
echo "🏥 Running health check..."
sleep 10

if [ ! -z "$HEALTH_CHECK_URL" ]; then
    if curl -f "$HEALTH_CHECK_URL/health" > /dev/null 2>&1; then
        echo "✅ Health check passed!"
    else
        echo "❌ Health check failed!"
        exit 1
    fi
fi

# Send deployment notification
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 Memento deployed successfully to $DEPLOY_TARGET!\"}" \
        "$SLACK_WEBHOOK_URL"
fi

echo "🎉 Deployment completed successfully!"

# Display important URLs and information
echo ""
echo "📋 Deployment Summary:"
echo "----------------------"
echo "Environment: $NODE_ENV"
echo "Target: ${DEPLOY_TARGET:-heroku}"
echo "Version: $(node -p "require('./package.json').version")"
echo "Timestamp: $(date)"
echo ""

if [ "$DEPLOY_TARGET" = "heroku" ]; then
    echo "🔗 Application URL: $(heroku apps:info --json | jq -r '.app.web_url')"
    echo "📊 Monitoring: https://dashboard.heroku.com/apps/$(heroku apps:info --json | jq -r '.app.name')"
fi

echo ""
echo "Next steps:"
echo "1. Test the application thoroughly"
echo "2. Monitor logs for any errors"
echo "3. Check payment processing functionality"
echo "4. Verify social media integrations"
echo "5. Test email notifications"