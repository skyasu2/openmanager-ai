import path from 'path';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { testAliases } from './shared-aliases';

const rootDir = path.resolve(__dirname, '../..');
const storybookConfigDir = path.resolve(rootDir, '.storybook');
const interactionTestTag = 'interaction-test';

export default defineConfig({
  resolve: {
    alias: testAliases,
  },
  test: {
    fileParallelism: false,
    // Vitest creates browser sessions from the root config before project
    // config is applied, so keep the connection timeout at the root level too.
    browser: {
      connectTimeout: 180_000,
    },
    projects: [
      {
        extends: true,
        plugins: [
          storybookTest({
            configDir: storybookConfigDir,
            tags: { include: [interactionTestTag] },
          }),
        ],
        test: {
          name: 'storybook',
          fileParallelism: false,
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
