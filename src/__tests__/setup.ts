/**
 * Jest test setup file
 * Runs before all tests to configure test environment
 */

import 'dotenv/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-not-for-production';
process.env.DB_STRATEGY = 'local';
process.env.POSTGRES_URL =
  process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/memorize_test';
process.env.PORT = '5001';

// Suppress database initialization logs during tests
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  // Optionally suppress logs during tests
  // console.log = jest.fn();
  // console.error = jest.fn();
});

afterAll(() => {
  // Restore console
  console.log = originalLog;
  console.error = originalError;
});
