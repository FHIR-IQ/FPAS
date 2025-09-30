import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Ensure this file is treated as a module
export {};

/**
 * Application configuration loaded from environment variables
 */
export const config = {
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  },

  fhir: {
    baseUrl: process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
    version: process.env.FHIR_VERSION || '4.0.1',
    timeout: parseInt(process.env.FHIR_TIMEOUT || '30000', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/fhir',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'poc-jwt-secret-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '1h',
    helmet: {
      enabled: process.env.HELMET_ENABLED !== 'false',
      csp: {
        enabled: process.env.CSP_ENABLED !== 'false',
      },
      hsts: {
        enabled: process.env.HSTS_ENABLED !== 'false',
      },
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CORS_CREDENTIALS !== 'false',
      methods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS',
      allowedHeaders: process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,X-Correlation-ID',
    },
  },

  performance: {
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '120000', 10),
    keepAliveTimeout: parseInt(process.env.KEEPALIVE_TIMEOUT || '65000', 10),
    maxRequestsPerSocket: parseInt(process.env.MAX_REQUESTS_PER_SOCKET || '0', 10),
  },

  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
  },

  features: {
    enableSwaggerUI: process.env.ENABLE_SWAGGER_UI !== 'false',
    enableX12Mapping: process.env.ENABLE_X12_MAPPING === 'true',
    mockVendorEnabled: process.env.MOCK_VENDOR_ENABLED !== 'false',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.LOG_PRETTY_PRINT === 'true' || process.env.NODE_ENV === 'development',
  },

  dtr: {
    launchUrl: process.env.DTR_LAUNCH_URL || 'http://localhost:3000/dtr-launch',
  },
};

export default config;