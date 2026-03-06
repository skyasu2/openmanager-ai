'use client';

const CSRF_COOKIE_KEY = 'csrf_token';
const CSRF_ISSUE_ENDPOINT = '/api/csrf-token';

/**
 * 브라우저 쿠키에서 CSRF 토큰을 읽는다.
 */
export function getCSRFTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';

  const cookies = document.cookie.split(';').map((cookie) => cookie.trim());
  const csrfCookie = cookies.find((cookie) =>
    cookie.startsWith(`${CSRF_COOKIE_KEY}=`)
  );

  if (!csrfCookie) return '';

  return csrfCookie.split('=')[1] || '';
}

/**
 * 토큰이 없으면 발급 API를 호출해 쿠키를 준비한다.
 */
export async function ensureCSRFToken(): Promise<string> {
  const existingToken = getCSRFTokenFromCookie();
  if (existingToken) return existingToken;

  const response = await fetch(CSRF_ISSUE_ENDPOINT, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Failed to issue CSRF token: ${response.status}`);
  }

  return getCSRFTokenFromCookie();
}

/**
 * 기존 헤더를 보존하면서 CSRF 토큰을 추가한다.
 */
export async function createCSRFHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  const token = await ensureCSRFToken();

  if (token && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', token);
  }

  return headers;
}
