/**
 * CSP(Content Security Policy) 유틸리티
 * Vercel 플랫폼에서 안전한 스크립트 실행 지원
 *
 * ## unsafe-inline → nonce 전환 로드맵
 *
 * 현재 상태: script-src에 'unsafe-inline' 포함 (B- 등급)
 *
 * 원인:
 * - Next.js 16.x가 인라인 스크립트를 런타임에 삽입 (프레임워크 제약)
 * - Vercel Analytics/Speed Insights가 인라인 스크립트 사용
 * - style-src의 'unsafe-inline'은 Tailwind CSS v4 런타임 스타일에 필수
 *
 * 전환 단계:
 * 1. [현재] generateCSPNonce() 인프라 준비 완료 — nonce 파라미터 지원
 * 2. [대기] Next.js의 built-in nonce 지원 안정화 (experimental.cspNonce)
 * 3. [대기] middleware.ts에서 nonce 생성 → <Script nonce={nonce}> 전파
 * 4. [목표] script-src에서 'unsafe-inline' 제거, nonce 기반 전환
 *
 * 참고: OWASP CSP Cheat Sheet, Next.js Security Headers 공식 문서
 */

/**
 * CSP 호환 nonce 생성 (Edge Runtime 최적화)
 * @returns Base64 인코딩된 nonce 문자열
 */
export function generateCSPNonce(): string {
  // Edge Runtime에서 crypto API 사용
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // Fallback for server-side rendering
  const randomBytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
  );
  return btoa(String.fromCharCode(...randomBytes));
}

/**
 * CSP 정책 문자열 생성 (환경별 최적화)
 * @param isDev 개발 환경 여부
 * @param isVercel Vercel 환경 여부
 * @param nonce Optional nonce 값
 * @returns CSP 정책 문자열
 */
export function generateCSPString(
  isDev: boolean = false,
  _isVercel: boolean = false,
  nonce?: string
): string {
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // 개발 환경에서만 unsafe-eval 허용
      ...(isDev ? ["'unsafe-eval'"] : []),
      // 기존 코드 호환성을 위해 unsafe-inline 유지 (점진적 제거 예정)
      "'unsafe-inline'",
      // Vercel 서비스
      'https://va.vercel-scripts.com',
      'https://vitals.vercel-insights.com',
      // 동적 스크립트 허용
      'blob:',
      // Nonce 기반 스크립트 (향후 사용)
      ...(nonce ? [`'nonce-${nonce}'`] : []),
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Tailwind CSS 호환
      'https://fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:', // Base64 이미지
      'blob:', // 동적 이미지
      'https:', // 외부 이미지 허용
      'https://vnswjnltnhpsueosfhmw.supabase.co', // Supabase Storage
    ],
    'connect-src': [
      "'self'",
      // API 엔드포인트
      'https://api.openmanager.dev',
      'https://vnswjnltnhpsueosfhmw.supabase.co', // Supabase
      'https://generativelanguage.googleapis.com', // Google AI
      // Vercel 서비스
      'https://va.vercel-scripts.com',
      'https://vitals.vercel-insights.com',
      // 개발 환경
      ...(isDev
        ? [
            'ws://localhost:3000',
            'http://localhost:3000',
            'ws://127.0.0.1:3000',
            'http://127.0.0.1:3000',
          ]
        : []),
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'data:', // Base64 폰트
    ],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': isDev ? [] : [''],
  };

  return Object.entries(directives)
    .filter(([_, values]) => values.length > 0)
    .map(([directive, values]) => {
      if (
        directive === 'upgrade-insecure-requests' &&
        values.length === 1 &&
        values[0] === ''
      ) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * API 엔드포인트용 제한적 CSP 정책
 */
export const API_CSP =
  "default-src 'self'; script-src 'none'; object-src 'none'; frame-src 'none';";

/**
 * 관리자 영역용 강화된 CSP 정책
 * @param baseCSP 기본 CSP 정책
 * @returns 강화된 CSP 정책
 */
export function getAdminCSP(baseCSP: string): string {
  return `${baseCSP}; require-trusted-types-for 'script';`;
}

/**
 * CSP 위반 리포트 수집을 위한 설정
 * @param reportUri 리포트 수집 URI
 * @returns CSP 리포트 지시어
 */
export function getCSPReportDirective(reportUri?: string): string {
  if (!reportUri) return '';
  return `; report-uri ${reportUri}; report-to csp-endpoint`;
}

/**
 * 무료 티어 최적화된 CSP 설정
 * 리소스 사용량을 최소화하면서 보안 유지
 */
export const FREE_TIER_CSP_OPTIONS = {
  // 리포트 수집 비활성화 (대역폭 절약)
  disableReporting: true,
  // 최소한의 외부 도메인만 허용
  restrictExternalDomains: true,
  // 개발 도구 접근 제한
  restrictDevTools: true,
} as const;

/**
 * CSP 호환성 검사
 * @param userAgent 사용자 에이전트 문자열
 * @returns CSP 지원 정보
 */
export function checkCSPSupport(userAgent?: string): {
  supportsCSP: boolean;
  supportsNonce: boolean;
  supportsTrustedTypes: boolean;
} {
  // 기본적으로 모든 최신 브라우저는 CSP를 지원
  return {
    supportsCSP: true,
    supportsNonce: true,
    supportsTrustedTypes:
      (userAgent?.includes('Chrome/') &&
        parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] || '0', 10) >= 83) ||
      false,
  };
}

/**
 * 보안 헤더 통합 생성기
 * @param options 설정 옵션
 * @returns 보안 헤더 객체
 */
export function generateSecurityHeaders(
  options: {
    isDev?: boolean;
    isVercel?: boolean;
    nonce?: string;
    customCSP?: string;
  } = {}
) {
  const { isDev = false, isVercel = false, nonce, customCSP } = options;

  const csp = customCSP || generateCSPString(isDev, isVercel, nonce);

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
    ...(isVercel && {
      'Strict-Transport-Security':
        'max-age=31536000; includeSubDomains; preload',
    }),
  };
}

/**
 * 환경별 CSP 설정 프리셋
 */
export const CSP_PRESETS = {
  development: {
    'script-src': "'self' 'unsafe-eval' 'unsafe-inline' blob:",
    'style-src': "'self' 'unsafe-inline'",
    'connect-src': "'self' ws: http: https:",
  },
  production: {
    'script-src':
      "'self' 'unsafe-inline' blob: https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
    'connect-src': "'self' https:",
  },
  strict: {
    'script-src': "'self'",
    'style-src': "'self'",
    'connect-src': "'self'",
    'object-src': "'none'",
    'frame-src': "'none'",
  },
} as const;
