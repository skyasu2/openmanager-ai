export const LOADING_MESSAGE_INTERVAL_MS = 1500;
export const SUCCESS_MESSAGE_TIMEOUT_MS = 3000;
export const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;
export const PAGE_REDIRECT_DELAY_MS = 500;
export const PULSE_ANIMATION_DURATION_MS = 600;
export const REDIRECT_STORAGE_KEY = 'auth_redirect_to';
export const DEFAULT_REDIRECT_PATH = '/';

export function sanitizeRedirectPath(rawValue: string | null): string | null {
  if (!rawValue) return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return null;
    }
    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return normalizedPath.startsWith('/') ? normalizedPath : null;
  } catch {
    return null;
  }
}
