import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

/**
 * External connectivity tests must stay outside the shared MSW setup.
 *
 * This config is intentionally opt-in via RUN_EXTERNAL_CONNECTIVITY_TESTS=true
 * and should not be included in default local or CI gates.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['tests/integration/external-services-connection.test.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**'],
    testTimeout: 60000,
    hookTimeout: 30000,
    pool: 'forks',
    isolate: true,
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: testAliases,
  },
});
