import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

/**
 * Contract Test 전용 경량 설정
 *
 * - MSW 기반 API 계약 테스트만 실행
 * - src/test/setup.ts 제외 (React, jest-dom, Supabase mock 불필요)
 * - lucide-react/recharts 등 heavy mock 제외
 * - cloud-run-contract.test.ts 제외 (실제 Cloud Run 호출 → CI 전용)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://mock-supabase-url.local',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key-for-testing',
    },
    setupFiles: [
      './config/testing/msw-setup.ts',
    ],
    include: [
      'tests/api/**/*contract*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'tests/api/cloud-run-contract.test.ts', // Cloud Run 실제 호출 → CI 전용
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'forks',
    isolate: false,
    coverage: {
      enabled: false,
    },
    reporters: ['default'],
  },
  resolve: {
    alias: testAliases,
  },
});
