import { defineConfig } from 'vitest/config';

const skipVisionTests = process.env.SKIP_VISION_TESTS === '1';
const baseExcludes = ['node_modules/**', 'dist/**'];
const visionExcludes = ['src/services/ai-sdk/agents/**/*vision*.test.ts'];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      ...baseExcludes,
      ...(skipVisionTests ? visionExcludes : []),
    ],
    testTimeout: 30000,
    hookTimeout: 120000,
    pool: 'forks',
    isolate: true,
  },
});
