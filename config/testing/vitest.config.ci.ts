import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * CI-Only Test Configuration
 *
 * @description 서버/외부 서비스가 필요한 통합 테스트 전용
 * - 로컬: 실행하지 않음 (환경 의존)
 * - CI/Vercel: 프로덕션 환경에서 실행
 *
 * @usage npm run test:ci (CI 환경에서만 실행)
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    setupFiles: [
      './src/test/setup.ts',
      './config/testing/msw-setup.ts',
    ],
    include: [
      // CI 전용 통합 테스트
      'tests/api/**/*.integration.test.{ts,tsx}',
      'tests/integration/security/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'tests/archive/**',
      'tests/e2e/**', // Playwright는 별도 실행
      'tests/manual/**',
    ],
    testTimeout: 60000, // 외부 서비스 연결로 타임아웃 증가
    hookTimeout: 30000,
    pool: 'threads',
    isolate: true,
    retry: 2, // CI에서 flaky 테스트 재시도
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
});
