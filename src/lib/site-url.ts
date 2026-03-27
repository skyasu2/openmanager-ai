const DEFAULT_SITE_URL = 'https://openmanager-ai.vercel.app';

function normalizeSiteUrl(input?: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.pathname = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function isInvalidProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === 'vercel.com'
  );
}

function shouldRejectCandidate(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && isInvalidProductionHost(parsed.hostname)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function getSiteUrl(): string {
  const isPreviewDeployment = process.env.VERCEL_ENV === 'preview';
  const previewRuntimeUrl = normalizeSiteUrl(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  );

  // Preview 환경에서는 배포 URL(VERCEL_URL)을 최우선 사용해
  // 고정 NEXT_PUBLIC_* 값으로 인한 도메인 오염을 방지한다.
  if (
    isPreviewDeployment &&
    previewRuntimeUrl &&
    !shouldRejectCandidate(previewRuntimeUrl)
  ) {
    return previewRuntimeUrl;
  }

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_PROD_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSiteUrl(candidate);
    if (normalized && !shouldRejectCandidate(normalized)) return normalized;
  }

  return DEFAULT_SITE_URL;
}
