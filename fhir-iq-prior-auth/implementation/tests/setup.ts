import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-unit-tests';
  process.env.REDIS_URL = 'redis://localhost:6379/1'; // Use different DB for tests
  process.env.FHIR_BASE_URL = 'http://localhost:8080/fhir';
});

// Global test teardown
afterAll(async () => {
  // Clean up any global resources
  await new Promise(resolve => setTimeout(resolve, 100));
});