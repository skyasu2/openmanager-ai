const CLIENT_IP_HEADER_KEYS = [
  'x-vercel-forwarded-for',
  'x-forwarded-for',
  'x-real-ip',
] as const;

interface ParsedCidrRange {
  network: number;
  mask: number;
}

function parseIpv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number.parseInt(part, 10);
    if (octet < 0 || octet > 255) return null;
    value = (value << 8) | octet;
  }

  return value >>> 0;
}

function normalizeIpv4(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  // IPv4:port 형태 정리
  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const candidate = ipv4WithPort?.[1] || trimmed;

  return parseIpv4ToInt(candidate) !== null ? candidate : null;
}

function parseCidrRange(rawCidr: string): ParsedCidrRange | null {
  const [rawIp, rawPrefix] = rawCidr.trim().split('/');
  if (!rawIp || rawPrefix === undefined) return null;

  const prefix = Number.parseInt(rawPrefix, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;

  const ipInt = parseIpv4ToInt(rawIp);
  if (ipInt === null) return null;

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: ipInt & mask, mask };
}

function parseBlockedChinaCidrs(
  rawValue: string | undefined
): ParsedCidrRange[] {
  if (!rawValue?.trim()) return [];

  return rawValue
    .split(',')
    .map((entry) => parseCidrRange(entry))
    .filter((entry): entry is ParsedCidrRange => Boolean(entry));
}

function isIpInCidrRanges(
  ip: string | null,
  ranges: ParsedCidrRange[]
): boolean {
  if (!ip || ranges.length === 0) return false;
  const ipInt = parseIpv4ToInt(ip);
  if (ipInt === null) return false;

  return ranges.some((range) => (ipInt & range.mask) === range.network);
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  for (const key of CLIENT_IP_HEADER_KEYS) {
    const raw = headers.get(key);
    if (!raw) continue;

    const firstIp = raw.split(',')[0];
    if (!firstIp) continue;

    const normalized = normalizeIpv4(firstIp);
    if (normalized) return normalized;
  }

  return null;
}

export function isGuestChinaIpRangeBlocked(headers: Headers): {
  blocked: boolean;
  clientIp: string | null;
} {
  const clientIp = getClientIpFromHeaders(headers);
  const cidrRanges = parseBlockedChinaCidrs(process.env.GUEST_CN_IP_CIDRS);

  return {
    blocked: isIpInCidrRanges(clientIp, cidrRanges),
    clientIp,
  };
}
