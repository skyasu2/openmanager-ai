import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { withSentryConfig } from '@sentry/nextjs';

const require = createRequire(import.meta.url);

// CSP 환경 변수 정규화 헬퍼 (path 제거, origin만 추출)
function safeOrigin(value, fallback) {
  try {
    return value ? new URL(value).origin : fallback;
  } catch {
    return fallback;
  }
}

// package.json에서 버전 읽기
const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
);
const sanitizedNextVersion = String(
  packageJson.dependencies?.next || ''
).replace(/^[^\d]*/, '');

// Bundle Analyzer 설정 (옵션 의존성 누락 시 no-op)
const withBundleAnalyzer = (() => {
  try {
    const bundleAnalyzer = require('@next/bundle-analyzer');
    return bundleAnalyzer({
      enabled: process.env.ANALYZE === 'true',
      openAnalyzer: false, // 자동 열지 않음
    });
  } catch {
    return (config) => config;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,

  // 🚀 Next.js 16 기본 설정 - Vercel/Docker 호환
  // NEXT_OUTPUT_MODE=standalone 환경변수로 Docker 빌드 시 standalone 출력 활성화
  output:
    process.env.NEXT_OUTPUT_MODE === 'standalone' ? 'standalone' : undefined,
  trailingSlash: false,

  // 📦 Output File Tracing: OTel 데이터 파일을 serverless 함수 번들에 포함
  // fs.readFile로 동적 로드하는 파일은 자동 추적이 안 되므로 명시적 포함 필요
  outputFileTracingIncludes: {
    '/*': ['./public/data/otel-data/**/*'],
  },

  // 🔧 Windows IDE에서 WSL 개발 서버 접속 허용 (Cross-Origin)
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.0.68:3000', // WSL IP (동적 변경 가능)
    'http://host.docker.internal:3000',
  ],

  // 실험적 기능 (Next.js 16 호환)
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@heroicons/react',
      'react-hot-toast',
      'recharts',
      'd3',
      // Phase 4.1: 번들 크기 최적화 (2025-12-08)
      '@ai-sdk/react',
      '@ai-sdk/ui-utils',
      'date-fns',
    ],
    // Vercel 무료 티어 최적화
    serverMinification: true,
    optimizeCss: false, // critters 의존성 문제로 비활성화
    // Next.js 15에서 runtime, swcMinify 제거됨 - 기본 제공
  },

  // 🚀 이미지 최적화 설정 (무료 티어 친화적 + 성능 우선)
  images: {
    unoptimized: false, // Next.js 이미지 최적화 활성화
    formats: ['image/webp', 'image/avif'], // AVIF 우선 (40% 더 작은 파일 크기)

    // 📱 디바이스 최적화 - 불필요한 크기 제거로 대역폭 절약
    deviceSizes: [640, 750, 828, 1080, 1200], // 1920px 제거로 대역폭 절약
    imageSizes: [16, 32, 48, 64, 96, 128], // 256px 제거로 대역폭 절약

    // ⚡ 캐싱 최적화 - 함수 호출 감소
    minimumCacheTTL: 86400 * 7, // 7일 캐시 (기존 1일 → 7일로 연장)

    // 🛡️ 보안 설정 유지
    dangerouslyAllowSVG: true, // SVG 허용
    contentDispositionType: 'attachment', // 보안 강화
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;", // SVG 보안

    // 🚀 무료 티어 최적화 추가 설정
    loader: 'default', // Vercel 기본 로더 사용 (최적화됨)
    // Note: images.domains는 Next.js 16에서 deprecated - remotePatterns만 사용
    remotePatterns: [
      // 필요한 외부 이미지만 허용
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // GitHub 아바타 이미지 (OAuth 로그인 사용자 프로필)
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/u/**',
      },
      // Google 아바타 이미지 (OAuth 로그인 사용자 프로필)
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // 페이지 확장자 최소화
  pageExtensions: ['tsx', 'ts'],

  // 🔧 TypeScript 설정 - 빌드 최적화
  typescript: {
    ignoreBuildErrors: false, // 타입 오류는 반드시 수정
  },
  // Note: eslint 설정은 Next.js 16에서 제거됨 - next lint CLI 옵션 사용

  // 🚀 Turbopack 설정 (Next.js 16 기본 빌드러)
  turbopack: {
    resolveAlias: {
      // @/ alias는 tsconfig.json paths로 자동 처리됨
      // 클라이언트 사이드: 서버 전용 모듈 폴백 비활성화
      fs: { browser: './src/lib/empty-module.js' },
      net: { browser: './src/lib/empty-module.js' },
      tls: { browser: './src/lib/empty-module.js' },
      crypto: { browser: './src/lib/empty-module.js' },
      'node:async_hooks': { browser: './src/lib/empty-module.js' },
      async_hooks: { browser: './src/lib/empty-module.js' },
    },
    // .node 네이티브 모듈은 serverExternalPackages로 외부화되어 별도 처리 불필요
  },

  // 서버 외부 패키지 설정 (번들 크기 감소)
  serverExternalPackages: [
    '@supabase/supabase-js',
    'sharp',
    'crypto-js',
    'axios',
  ],

  // skipTrailingSlashRedirect를 root 레벨로 이동
  skipTrailingSlashRedirect: true,

  // 🚨 devtools 설정 - E2E 테스트 시 완전 비활성화
  // NEXT_PUBLIC_E2E_TESTING=true 또는 PLAYWRIGHT_SKIP_SERVER=1 환경변수로 제어
  devIndicators:
    process.env.NEXT_PUBLIC_E2E_TESTING === 'true' ||
    process.env.PLAYWRIGHT_SKIP_SERVER === '1' ||
    process.env.NEXT_DISABLE_DEVTOOLS === '1'
      ? false // E2E 테스트 시 완전 비활성화
      : { position: 'bottom-right' },

  // 컴파일러 최적화
  compiler: {
    // 미사용 코드 제거 (E2E 테스트 시 console.log 보존)
    removeConsole:
      process.env.NODE_ENV === 'production' &&
      process.env.PRESERVE_CONSOLE !== 'true',
    // React DevTools 제거 (프로덕션 + 테스트 모드)
    reactRemoveProperties:
      process.env.NODE_ENV === 'production' ||
      process.env.__NEXT_TEST_MODE === 'true',
  },

  // 🚧 리라이트 설정 (개발 환경 전용 파일 보호)
  async rewrites() {
    // 미사용 dev-only rewrites 제거 (2026-03-16):
    // /test-tools/:path* → /tests/browser/:path* 및 /dev/:path* → /api/dev/:path* 는
    // 대상 라우트(src/app/tests/browser/, src/app/api/dev/)가 존재하지 않아 dead code였음.
    // next dev --webpack 모드에서 rewrites가 있으면 첫 요청 시 "Compiling proxy" 단계가
    // 추가되므로 불필요한 진입점을 제거해 라우팅 경로를 단순화함.
    return [];
  },

  // 🔄 리다이렉트 설정 (BF-Cache 최적화)
  async redirects() {
    return [
      // ✅ Pattern C (App-First): "/" 에서 바로 메인 앱 표시
      // - 비로그인 사용자도 메인 페이지 접근 가능
      // - 로그인이 필요한 기능은 LoginPrompt로 유도
      // - src/app/page.tsx의 랜딩 페이지 렌더링

      // www -> non-www 리다이렉트 (SEO 최적화)
      {
        source: '/www/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },

  // 🛡️ 보안 헤더 및 CSP 설정 (개발 환경에서 임시 비활성화)
  async headers() {
    // 개발 환경에서는 CSP 헤더 비활성화로 MIME type 문제 해결
    // 로컬 서버에서도 임시 비활성화 (Bundle-Safe 매크로 및 CSP 문제 해결)
    if (process.env.NODE_ENV === 'development') {
      return [];
    }
    // 이 함수는 production 전용 (개발 환경은 위의 early return으로 이미 제외)
    const isVercel = process.env.VERCEL === '1';

    // 🎯 개발/프로덕션 환경별 CSP 정책
    const cspDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-eval'", // React 18 하이드레이션 필수 (포트폴리오 프로젝트)
        "'unsafe-inline'", // React SSR/하이드레이션 inline 스크립트 허용 (포트폴리오 프로젝트)
        'https://vercel.live', // Vercel Toolbar
        'https://va.vercel-scripts.com', // Vercel Analytics
        'https://vitals.vercel-insights.com', // Speed Insights
        'https://js-de.sentry-cdn.com', // Sentry Loader (EU)
        'blob:', // 동적 스크립트 허용
      ].filter(Boolean),
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Tailwind CSS 인라인 스타일
      ],
      'img-src': [
        "'self'",
        'data:', // Base64 이미지
        'blob:', // 동적 이미지
        'https:', // 외부 이미지 허용
        safeOrigin(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          'https://vnswjnltnhpsueosfhmw.supabase.co'
        ), // Supabase Storage
      ].filter(Boolean),
      'connect-src': [
        "'self'",
        'https://vercel.live', // Vercel Toolbar
        safeOrigin(
          process.env.NEXT_PUBLIC_API_URL,
          'https://api.openmanager.dev'
        ), // 자체 API
        safeOrigin(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          'https://vnswjnltnhpsueosfhmw.supabase.co'
        ), // Supabase
        // Cloud Run AI Engine은 별도 도메인 사용 (CLOUD_RUN_AI_URL)
        'https://va.vercel-scripts.com', // Vercel Analytics
        'https://vitals.vercel-insights.com', // Speed Insights
        'https://*.ingest.de.sentry.io', // Sentry EU (tunnel fallback)
        // 개발 환경 WebSocket/API는 early return으로 이미 제외됨
      ].filter(Boolean),
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com', // Google Fonts
        'data:', // Base64 폰트
      ],
      'frame-src': [
        'https://vercel.live', // Vercel Toolbar 허용
      ],
      'object-src': [
        "'none'", // Object/Embed 차단
      ],
      'base-uri': [
        "'self'", // Base URI 제한
      ],
      'form-action': [
        "'self'", // Form action 제한
      ],
      'upgrade-insecure-requests': [''], // HTTPS 강제 (production only)
    };

    // CSP 문자열 생성
    const csp = Object.entries(cspDirectives)
      .filter(([_, values]) => values.length > 0)
      .map(([key, values]) => {
        if (
          key === 'upgrade-insecure-requests' &&
          values.length === 1 &&
          values[0] === ''
        ) {
          return key;
        }
        return `${key} ${values.join(' ')}`;
      })
      .join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // 🛡️ 보안 헤더
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 🛡️ Permissions Policy (Feature Policy 후속)
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // 🔐 Strict-Transport-Security (HSTS)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // 🔐 CSP 헤더 (Vercel 환경 최적화)
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
          // ⚡ 성능 최적화 (BF-Cache 친화적)
          {
            key: 'Cache-Control',
            value:
              'public, max-age=0, must-revalidate, stale-while-revalidate=86400',
          },
          // 📄 페이지별 BF-Cache 설정
          {
            key: 'Vary',
            value: 'Accept-Encoding, User-Agent',
          },
          // 🚀 Vercel 전용 최적화 헤더
          ...(isVercel
            ? [
                {
                  key: 'X-Vercel-Cache',
                  value: 'HIT',
                },
                {
                  key: 'X-Edge-Runtime',
                  value: 'vercel',
                },
              ]
            : []),
        ],
      },
      // 📊 API 경로별 특별 CSP 정책
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'none'; object-src 'none';",
          },
        ],
      },
      // 🔧 관리자 영역 강화 보안
      {
        source: '/admin/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `${csp}; require-trusted-types-for 'script';`,
          },
          {
            key: 'X-Admin-Security',
            value: 'enhanced',
          },
        ],
      },
    ];
  },

  // 🔧 웹팩 설정 (번들 최적화)
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': join(process.cwd(), 'src'),
      // 기존 alias 유지
    };

    // 🔧 Next.js 16 DevTools 설정 (v5.80.0 - 간소화)
    // Note: 이전 버전의 공격적인 module aliasing은 클라이언트 하이드레이션을 깨뜨림
    // DevTools 관련 이슈는 NEXT_DISABLE_DEVTOOLS=1 환경변수로만 제어

    // 클라이언트 사이드 최적화
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        'node:async_hooks': false,
        async_hooks: false,
      };

      // 강화된 React 모듈 해결 설정
      config.resolve.alias = {
        ...config.resolve.alias,
        react: 'react',
        'react-dom': 'react-dom',
        'react/jsx-runtime': 'react/jsx-runtime',
        'react/jsx-dev-runtime': 'react/jsx-dev-runtime',
      };

      // React 모듈 검색 경로 명시적 설정
      config.resolve.modules = [
        'node_modules',
        ...(config.resolve.modules || []),
      ];

      // Next.js 기본 splitChunks 사용 (CSS 문제 해결)
    }

    // Next.js 기본 최적화 사용

    // 큰 파일 및 테스트 파일 제외
    config.module.rules.push(
      {
        test: /\.node$/,
        use: 'ignore-loader',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/fonts/[hash][ext]',
        },
      },
      // 프로덕션 빌드에서 테스트 파일 제외
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              test: /\/tests\/.*\.(html|js|ts|tsx)$/,
              use: 'ignore-loader',
            },
            {
              test: /\/public\/test-.*\.html$/,
              use: 'ignore-loader',
            },
            {
              test: /\.(spec|test)\.(js|jsx|ts|tsx)$/,
              use: 'ignore-loader',
            },
          ]
        : [])
    );

    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      // Module not found 경고 제거로 경로 문제 조기 발견
      /Can't resolve '\.\/.*\.node'/,
    ];

    return config;
  },

  // 환경 변수 최소화
  env: {
    CUSTOM_KEY: 'openmanager-ai',
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_NEXTJS_VERSION: sanitizedNextVersion || 'unknown',
  },
};

export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  {
    // 🎯 무료 티어: 소스맵 업로드 비활성화
    silent: true,
    org: 'om-4g',
    project: 'javascript-nextjs',

    // 🎯 무료 티어: 소스맵 업로드 완전 비활성화
    sourcemaps: {
      disable: true,
    },
  },
  {
    // 🎯 무료 티어 최적화 설정
    widenClientFileUpload: false, // 소스맵 업로드 비활성화
    transpileClientSDK: false, // 번들 사이즈 최적화
    tunnelRoute: '/api/sentry-tunnel', // ad-blocker 우회 (수동 API route 사용)
    hideSourceMaps: true, // 클라이언트 소스맵 숨김
    disableLogger: true, // 로거 트리쉐이킹
    automaticVercelMonitors: false, // Cron 모니터링 비활성화 (무료 제한)
  }
);
