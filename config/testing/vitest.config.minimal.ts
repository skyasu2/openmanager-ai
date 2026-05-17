import { defineConfig } from 'vitest/config';
import { testAliases } from './shared-aliases';

const quickNodeTestPatterns = [
  // Keep this suite node-only. Broader directory globs pull DOM/integration tests
  // into test:quick and make the smoke gate slower and less deterministic.
  'src/utils/*-functions.test.ts',
  'src/lib/utils/*.test.ts',
  'src/validators/**/*Schema.test.ts',
  'src/lib/ai/utils/{context-compressor,query-complexity}.test.ts',
  'src/app/api/ai/supervisor/{cache-utils,security}.test.ts',
  'src/services/monitoring/HealthCalculator.test.ts',
  'tests/artifacts/**/*.bench.ts',
  'tests/intent-classifier/**/*.eval.test.ts',
  'tests/unit/dev/{vercel-font-source-guard,landing-cursor-guard,periodic-jobs-contract,component-map-verify-script,api-endpoints-doc-contract}.test.ts',
];

/**
 * 🚀 최소 테스트 설정
 * 빠른 회귀 확인용 핵심 유틸/보안/스키마 테스트만 실행
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // DOM 불필요 - 순수 함수만
    include: quickNodeTestPatterns,
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
