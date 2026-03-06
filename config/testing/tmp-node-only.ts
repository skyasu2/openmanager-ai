import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/lib/utils/time.test.ts'],
    pool: 'threads',
    isolate: false,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
