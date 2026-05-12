// Shared test bootstrap — set required env vars before any module reads them.
// Imported by every route test BEFORE the supertest app/import.
process.env.APP_PASSWORD ??= 'test-password';
process.env.JWT_SECRET ??= 'unit-test-jwt-secret-long-enough';
process.env.GEMINI_KEY ??= 'test-gemini-key';
process.env.PORT ??= '0';
process.env.NODE_ENV ??= 'test';

export const TEST_PASSWORD = 'test-password';
export const TEST_JWT_SECRET = 'unit-test-jwt-secret-long-enough';
