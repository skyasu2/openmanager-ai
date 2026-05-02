import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

/**
 * 🚀 최소 테스트 설정
 * 빠른 회귀 확인용 핵심 유틸/보안/스키마 테스트만 실행
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // DOM 불필요 - 순수 함수만
    include: [
      // Co-located 순수 함수 테스트만 포함 (jsdom 불필요)
      'src/utils/type-guards.test.ts',
      'src/utils/utils-functions.test.ts',
      'src/lib/utils/time.test.ts',
      // Phase 1 추가: validators + AI utils
      'src/validators/paginationQuerySchema.test.ts',
      'src/lib/ai/utils/context-compressor.test.ts',
      'src/lib/ai/utils/query-complexity.test.ts',
      // Phase 2 추가: AI supervisor utils
      'src/app/api/ai/supervisor/cache-utils.test.ts',
      'src/app/api/ai/supervisor/security.test.ts',
      // Phase 3 추가: monitoring
      'src/services/monitoring/HealthCalculator.test.ts',
      // Deployment drift guards
      'tests/unit/dev/vercel-font-source-guard.test.ts',
      'tests/unit/dev/periodic-jobs-contract.test.ts',
      'tests/unit/dev/component-map-verify-script.test.ts',
      'tests/unit/dev/api-endpoints-doc-contract.test.ts',
      // 참고: integration 테스트는 별도 config에서 실행
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
        // Node-only quick smoke tests do not need Vite pre-bundling.
        // Keeping this off avoids noisy dep-scan over generated HTML artifacts.
        client: {
          enabled: false,
        },
        ssr: {
          enabled: false,
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
