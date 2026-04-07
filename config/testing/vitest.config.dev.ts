import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.main';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
    include: [
      'tests/unit/dev/**/*.{test,spec}.{js,ts,tsx}',
      'tests/unit/qa/**/*.{test,spec}.{js,ts,tsx}',
      'tests/unit/playwright/**/*.{test,spec}.{js,ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'out/**',
      'cloud-run/**',
      'tests/e2e/**',
      'tests/manual/**',
    ],
    setupFiles: [],
    pool: 'forks',
    isolate: false,
    maxForks: 1,
    minForks: 1,
  },
});
