export const AUTH_SESSION_ID_KEY = 'auth_session_id';
export const AUTH_TYPE_KEY = 'auth_type';
export const AUTH_USER_KEY = 'auth_user';
export const AUTH_CREATED_AT_KEY = 'auth_created_at';
export const LEGACY_GUEST_SESSION_COOKIE_KEY = 'guest_session_id';

function readCookieValue(cookieHeader: string, key: string): string | null {
  const match = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${key}=`));
  if (!match) return null;
  const rawValue = match.split('=').slice(1).join('=');
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function getGuestSessionIdFromCookieHeader(
  cookieHeader: string
): string | null {
  return (
    readCookieValue(cookieHeader, AUTH_SESSION_ID_KEY) ||
    readCookieValue(cookieHeader, LEGACY_GUEST_SESSION_COOKIE_KEY)
  );
}

export function hasGuestSessionCookieHeader(cookieHeader: string): boolean {
  return Boolean(getGuestSessionIdFromCookieHeader(cookieHeader));
}

export function hasGuestStorageState(params: {
  sessionId: string | null;
  authType?: string | null;
  userJson?: string | null;
}): boolean {
  const hasSession = Boolean(params.sessionId);
  const hasUserPayload = Boolean(params.userJson);
  const hasLegacyGuestType = params.authType === 'guest';
  return hasSession && (hasUserPayload || hasLegacyGuestType);
}
