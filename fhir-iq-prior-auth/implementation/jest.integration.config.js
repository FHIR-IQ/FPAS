module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.(js|jsx|ts|tsx)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globalTeardown: '<rootDir>/tests/teardown.ts'
};