import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

/**
 * 🚀 최소 테스트 설정 - 22ms 초고속 실행
 * Mock 테스트 제거 후 순수 함수만 테스트
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // DOM 불필요 - 순수 함수만
    include: [
      // Co-located 순수 함수 테스트만 포함 (jsdom 불필요)
      'src/utils/type-guards.test.ts',
      'src/utils/metricValidation.test.ts',
      'src/utils/utils-functions.test.ts',
      'src/lib/project-meta.test.ts',
      'src/lib/utils/time.test.ts',
      'src/safe-format.test.ts',
      // Phase 1 추가: validators + AI utils
      'src/validators/paginationQuerySchema.test.ts',
      'src/lib/ai/utils/context-compressor.test.ts',
      'src/lib/ai/utils/query-complexity.test.ts',
      // Phase 2 추가: AI supervisor utils
      'src/app/api/ai/supervisor/cache-utils.test.ts',
      'src/app/api/ai/supervisor/security.test.ts',
      // Phase 2 추가: metrics
      'src/services/metrics/variation-generator.test.ts',
      // Phase 3 추가: monitoring
      'src/services/monitoring/HealthCalculator.test.ts',
      // 참고: integration 테스트는 jsdom 필요하므로 vitest.config.ts 사용
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'out/**',
    ],
    testTimeout: 5000, // 타임아웃 증가
    hookTimeout: 5000,
    pool: 'vmThreads', // 4배 성능 향상
    isolate: false, // 격리 비활성화
    retry: 1, // 실패 시 1번 재시도
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
    coverage: {
      enabled: false, // CI에서는 커버리지 비활성화
    },
    reporters: ['default'], // 간단한 리포터만 사용
  },
  resolve: {
    alias: testAliases,
  },
});
