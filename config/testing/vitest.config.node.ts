import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.main';
import { domTestGlobs } from './dom-test-globs';

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    environment: 'node',
    setupFiles: [
      './src/test/setup.node.ts',
      './config/testing/msw-setup.ts',
    ],
    exclude: [...(baseConfig.test?.exclude ?? []), ...domTestGlobs],
  },
});
