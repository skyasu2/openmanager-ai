/**
 * CORS 헤더 설정
 * API 라우트에서 사용하는 공통 CORS 헤더
 */

const ALLOWED_ORIGINS = [
  'https://openmanager-ai.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

/** Vercel Preview URL 패턴: openmanager-ai-*.vercel.app */
const VERCEL_PREVIEW_PATTERN =
  /^https:\/\/openmanager-ai-[a-z0-9-]+\.vercel\.app$/;

/**
 * 요청 origin이 허용된 origin인지 확인
 */
function resolveOrigin(requestOrigin?: string | null): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !ALLOWED_ORIGINS.includes(appUrl)) {
    ALLOWED_ORIGINS.push(appUrl);
  }

  // Vercel Preview URL: 프로젝트 소유 프리뷰만 허용
  if (requestOrigin && VERCEL_PREVIEW_PATTERN.test(requestOrigin)) {
    return requestOrigin;
  }

  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  return appUrl || 'https://openmanager-ai.vercel.app';
}

/**
 * 동적 CORS 헤더 생성
 * @param requestOrigin - Request의 Origin 헤더 값
 */
export function getCorsHeaders(
  requestOrigin?: string | null
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(requestOrigin),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * 정적 CORS 헤더 (하위 호환용)
 * 새 코드에서는 getCorsHeaders()를 사용하세요
 */
export const corsHeaders = getCorsHeaders();

/**
 * OPTIONS 요청을 처리하는 헬퍼 함수
 */
export function handleOptionsRequest(request?: Request) {
  const origin = request?.headers.get('origin');
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}
