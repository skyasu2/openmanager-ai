/**
 * Guest region policy helpers.
 *
 * CN(중국) 차단이 기본값이며, 필요 시 환경변수로 확장할 수 있습니다.
 */

const COUNTRY_HEADER_KEYS = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'x-country-code',
] as const;

const DEFAULT_BLOCKED_COUNTRIES = ['CN'] as const;

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized.length !== 2) return null;
  return normalized;
}

function parseBlockedCountries(rawValue: string | undefined): Set<string> {
  const entries = (rawValue || DEFAULT_BLOCKED_COUNTRIES.join(','))
    .split(',')
    .map((entry) => normalizeCountryCode(entry))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(entries.length > 0 ? entries : DEFAULT_BLOCKED_COUNTRIES);
}

export function getRequestCountryCode(headers: Headers): string | null {
  for (const key of COUNTRY_HEADER_KEYS) {
    const value = normalizeCountryCode(headers.get(key));
    if (value) return value;
  }

  return null;
}

export function isGuestCountryBlocked(countryCode: string | null): boolean {
  if (!countryCode) return false;

  const blockedCountries = parseBlockedCountries(
    process.env.GUEST_LOGIN_BLOCKED_COUNTRIES
  );
  return blockedCountries.has(countryCode);
}
