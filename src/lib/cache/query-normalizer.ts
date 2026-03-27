const CACHE_STOPWORDS = new Set([
  '좀',
  '제발',
  '부탁',
  '부탁해',
  '부탁합니다',
  '알려줘',
  '알려주세요',
  '보여줘',
  '보여주세요',
  '조회',
  '확인',
  '현재',
  '지금',
  'please',
  'show',
  'tell',
  'check',
  'fetch',
  'get',
  'the',
  'a',
  'an',
  'for',
  'to',
  'of',
  'and',
  'or',
  'me',
]);

function canonicalizeCacheToken(token: string): string {
  if (!token) return '';
  const lower = token.toLowerCase();

  if (lower.startsWith('cpu') || lower === '씨피유') return 'cpu';
  if (
    lower === '메모리' ||
    lower === 'memory' ||
    lower === 'ram' ||
    lower === '램'
  ) {
    return 'memory';
  }
  if (
    lower === '디스크' ||
    lower === 'disk' ||
    lower === 'storage' ||
    lower === '스토리지'
  ) {
    return 'disk';
  }
  if (
    lower === '네트워크' ||
    lower === 'network' ||
    lower === 'bandwidth' ||
    lower === '트래픽'
  ) {
    return 'network';
  }
  if (lower === '서버' || lower === 'servers') return 'server';
  if (
    lower === '상태' ||
    lower === 'status' ||
    lower === 'health' ||
    lower === '헬스'
  ) {
    return 'status';
  }
  if (lower === 'usage' || lower === '사용률' || lower === '점유율') {
    return 'utilization';
  }

  return lower;
}

export function normalizeSemanticCacheQuery(query: string): string {
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[^0-9a-zA-Z가-힣\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '';
  }

  const canonicalTokens = normalized
    .split(' ')
    .map((token) => canonicalizeCacheToken(token))
    .filter((token) => token.length > 0 && !CACHE_STOPWORDS.has(token));

  if (canonicalTokens.length === 0) {
    return normalized;
  }

  return Array.from(new Set(canonicalTokens)).sort().join(' ');
}
