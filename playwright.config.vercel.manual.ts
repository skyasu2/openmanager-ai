import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.vercel';

export default defineConfig({
  ...baseConfig,
  // 수동 전용 테스트만 명시적으로 실행한다.
  testMatch: '**/*.manual.ts',
});
