import path from 'path';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { testAliases } from './shared-aliases';

const rootDir = path.resolve(__dirname, '../..');
const storybookConfigDir = path.resolve(rootDir, '.storybook');

export default defineConfig({
  resolve: {
    alias: testAliases,
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: storybookConfigDir })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            connectTimeout: 180_000,
            instances: [{ browser: 'chromium' }],
          },
          setupFiles: [path.resolve(storybookConfigDir, 'vitest.setup.ts')],
        },
      },
    ],
  },
});
