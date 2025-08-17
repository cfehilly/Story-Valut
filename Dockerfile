# Multi-stage Docker build for Memento App
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S memento -u 1001

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build --chown=memento:nodejs /app/dist ./dist
COPY --from=build --chown=memento:nodejs /app/server ./server
COPY --from=build --chown=memento:nodejs /app/public ./public

# Create logs directory
RUN mkdir -p /app/logs && chown -R memento:nodejs /app/logs

# Switch to non-root user
USER memento

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "http.get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "server/index.js"]

# Labels
LABEL name="memento-app"
LABEL version="1.0.0"
LABEL description="Digital time capsule for preserving social media memories"
LABEL maintainer="memento-team"