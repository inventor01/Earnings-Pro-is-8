// Standalone jest config (NOT in package.json) so the OTA fingerprint — which
// hashes package.json "scripts" — stays identical to the installed build. Run
// the suite with `npx jest` (no "test" script is added to package.json for the
// same fingerprint reason).
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['./jest.setup.js'],
};
