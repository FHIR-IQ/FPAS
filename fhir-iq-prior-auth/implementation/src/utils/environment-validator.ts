import { config } from '../config/environment';

/**
 * Validates required environment variables and configuration
 * Throws error if critical configuration is missing
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if running in Vercel POC environment
  const isVercelPOC = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  // Validate critical settings
  if (!config.app.port || isNaN(config.app.port)) {
    errors.push('PORT must be a valid number');
  }

  if (!config.fhir.baseUrl) {
    if (isVercelPOC) {
      warnings.push('FHIR_BASE_URL not set - using default mock endpoints');
    } else {
      errors.push('FHIR_BASE_URL is required');
    }
  }

  if (!config.redis.url) {
    if (isVercelPOC) {
      warnings.push('REDIS_URL not set - background job processing disabled');
    } else {
      errors.push('REDIS_URL is required');
    }
  }

  // Validate security settings in production
  if (config.app.nodeEnv === 'production' && !isVercelPOC) {
    if (config.security.jwtSecret === 'poc-jwt-secret-change-in-production') {
      errors.push('JWT_SECRET must be changed in production environment');
    }

    if (config.security.cors.origin === '*') {
      warnings.push('CORS is set to allow all origins (*) in production. Consider restricting this.');
    }
  } else if (isVercelPOC) {
    warnings.push('Running in POC mode with default security settings - not suitable for production');
  }

  // Validate Redis configuration
  if (config.redis.port && isNaN(config.redis.port)) {
    errors.push('REDIS_PORT must be a valid number');
  }

  // Validate performance settings
  if (config.performance.requestTimeout < 1000) {
    errors.push('REQUEST_TIMEOUT should be at least 1000ms');
  }

  // Validate rate limiting
  if (config.rateLimit.maxRequests < 1) {
    errors.push('RATE_LIMIT_MAX must be greater than 0');
  }

  // Validate queue settings
  if (config.queue.concurrency < 1) {
    errors.push('QUEUE_CONCURRENCY must be at least 1');
  }

  // If there are errors, throw
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }

  // Log warnings
  if (warnings.length > 0 && config.app.nodeEnv !== 'test') {
    console.warn('Environment validation warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  // Log successful validation
  if (config.app.nodeEnv !== 'test') {
    console.log('Environment validation passed');
    console.log(`  - Node environment: ${config.app.nodeEnv}`);
    console.log(`  - Port: ${config.app.port}`);
    console.log(`  - FHIR base URL: ${config.fhir.baseUrl}`);
    console.log(`  - Redis URL: ${config.redis.url}`);
    console.log(`  - Swagger UI: ${config.features.enableSwaggerUI ? 'enabled' : 'disabled'}`);
    if (isVercelPOC) {
      console.log('  - Running in Vercel POC mode');
    }
  }
}