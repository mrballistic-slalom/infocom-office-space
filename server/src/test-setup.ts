// Shared test bootstrap — set required env vars before any module reads them.
// Imported by every route test BEFORE the supertest app/import.
process.env.GEMINI_KEY ??= 'test-gemini-key';
process.env.PORT ??= '0';
process.env.NODE_ENV ??= 'test';
