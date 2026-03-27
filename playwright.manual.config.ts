import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  testDir: './tests/manual',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 240_000,
});
