# Multi-stage build for Node.js TypeScript application
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start development server with hot reload
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S fpas -u 1001

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build --chown=fpas:nodejs /app/dist ./dist

# Copy any necessary static files
COPY --chown=fpas:nodejs src/config ./src/config

# Switch to non-root user
USER fpas

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node dist/scripts/healthcheck.js

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]