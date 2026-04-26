import { defineConfig } from 'vitest/config';

/**
 * Cloud Run Contract Test Configuration
 *
 * Runs only the live Cloud Run contract tests. Do not include the shared MSW
 * setup here: these tests intentionally call the deployed AI Engine.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: [
      'tests/api/cloud-run-contract.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'out/**',
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    isolate: true,
    coverage: {
      enabled: false,
    },
    reporters: ['default'],
  },
});
