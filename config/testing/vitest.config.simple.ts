import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

/**
 * 📊 커버리지 테스트 설정 - Mock 제거 후 단순화
 * 순수 함수와 유틸리티 중심의 커버리지 측정
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/utils/**/*.{test,spec}.{js,ts}',
      'tests/unit/**/*.{test,spec}.{js,ts}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'out/**',
      // 복잡한 Mock 테스트 제외 (삭제됨)
      'src/services/ai/**',
      'src/app/api/**/__tests__/**',
      'tests/integration/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/utils/**/*.{js,ts}',
        'src/lib/**/*.{js,ts}',
        'src/types/**/*.{js,ts}',
      ],
      exclude: [
        'node_modules/**',
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        'src/**/*.stories.*',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        // Mock이 복잡한 서비스들 제외
        'src/services/ai/**',
        'src/app/api/**',
      ],
      thresholds: {
        global: {
          branches: 10,
          functions: 10,
          lines: 10,
          statements: 10
        }
      }
    },
    testTimeout: 5000,
    hookTimeout: 5000,
    pool: 'vmThreads',
    isolate: false,
  },
  resolve: {
    alias: testAliases,
  },
  esbuild: {
    target: 'node14',
  },
});