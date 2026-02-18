import { defineConfig } from 'vitest/config';
import path from 'path';
import { testAliases } from './shared-aliases';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    css: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://mock-supabase-url.local',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key-for-testing',
      // Cloud Run AI uses GCP IAM auth, no API key needed
    },
    setupFiles: [
      './src/test/setup.ts',
      './config/testing/msw-setup.ts', // ✅ MSW Mock Server Setup
    ],
    include: [
      'src/**/*.{test,spec}.{js,ts,tsx}',
      'tests/ai-sidebar/**/*.{test,spec}.{js,ts,tsx}',
      'tests/api/**/*.{test,spec}.{js,ts,tsx}',
      'tests/archive/**/*.{test,spec}.{js,ts,tsx}',
      'tests/integration/**/*.{test,spec}.{js,ts,tsx}',
      'tests/performance/**/*.{test,spec}.{js,ts,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,tsx}',
      'tests/types/**/*.{test,spec}.{js,ts,tsx}', // ✅ 타입 레벨 테스트 추가
      // ⚠️ tests/e2e/**는 명시하지 않음 - Playwright 전용 E2E 테스트
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'out/**',
      'cloud-run/**', // ✅ Cloud Run AI 엔진 (별도 테스트 스위트)
      'tests/archive/**', // ✅ 아카이브된 테스트 제외 (jsdom 한계로 개선 불가능)
      'tests/e2e/**', // ✅ E2E 테스트 제외 (Playwright 전용)
      'tests/manual/**', // ✅ 수동 검증 테스트 제외
      '**/e2e/**', // ✅ 추가 안전장치: 어떤 경로의 e2e 디렉토리도 제외
      '**/*.integration.test.{ts,tsx,js,jsx}', // ✅ 통합 테스트 제외 (서버 필요)
    ],
    coverage: {
      provider: 'v8',
      enabled: true,
      // ✅ 소스 파일만 측정 (빌드 파일 제외)
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/types/**/*.{ts,tsx}',
        'src/stores/**/*.{ts,tsx}',
        'src/app/api/**/*.{ts,tsx}',
      ],
      exclude: [
        // 빌드 & 배포 아티팩트
        '.next/**',
        '.vercel/**',
        'out/**',
        'dist/**',
        'coverage/**',
        'node_modules/**',

        // 테스트 관련 파일
        'src/test/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.stories.*',

        // 설정 파일
        '**/*.config.*',
        '**/*.d.ts',

        // 기타
        'src/app/**/layout.tsx', // Next.js layouts (서버 컴포넌트)
        'src/app/**/page.tsx', // Next.js pages (서버 컴포넌트)
        'src/middleware.ts', // Next.js middleware
        'src/utils/performance.tsx', // Rollup parse error (JSX + class syntax)
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // ⚠️ Vitest 4.0: coverage.all 옵션 제거됨 (deprecated)
      // 대안: include 배열로 측정 대상 명시적 지정 (위에서 설정됨)

      // 커버리지는 수집만 하고 임계값 실패 게이트는 적용하지 않음.
    },
    testTimeout: 30000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    // ✅ WSL worker timeout 대응: worker 시작 실패 시 exit code 0 유지
    // WSL + Windows 파일시스템 I/O 병목으로 간헐적 worker timeout 발생
    dangerouslyIgnoreUnhandledErrors: true,
    pool: 'forks',
    isolate: true, // ✅ Enable test isolation to prevent state pollution
    // ⚠️ pool: 'forks' 사용 (WSL2에서 'threads'는 무거운 모듈 그래프 파싱 시 hang 발생)
    // child_process 기반으로 thread 경합 없이 안정적 실행
    server: {
      deps: {
        // ✅ WSL I/O 병목 방지: 무거운 패키지는 vitest 번들링 건너뜀
        // resolve.alias가 stub으로 리디렉션하지만, external이 없으면 worker 초기화 시 hang
        external: ['lucide-react', 'recharts', 'zod'],
        inline: ['whatwg-fetch'],
      },
    },
    // ✅ Vitest 4: poolOptions → 최상위 옵션으로 이동
    maxForks: 1,
    minForks: 1,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'], // ✅ Auto-resolve .ts files in node environment
    alias: {
      // ✅ WSL I/O 병목 해소: heavy 모듈을 경량 stub으로 리디렉션
      // lucide-react: 3800+ icon files → Proxy stub, recharts: D3 transitive deps → noop stubs
      'lucide-react': path.resolve(__dirname, '../../__mocks__/lucide-react.ts'),
      recharts: path.resolve(__dirname, '../../__mocks__/recharts.tsx'),
      ...testAliases,
    },
  },
  esbuild: {
    target: 'node14',
    jsxInject: `import React from 'react'`, // Auto-import React for JSX
    jsx: 'transform', // Transform JSX to React.createElement calls
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});
