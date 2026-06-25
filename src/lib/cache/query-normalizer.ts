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

// ============================================================================
// intro(보편 기술 소개) 전용 정규화 — supervisor-intro 글로벌 캐시 hit-rate 개선
// 안전 경계: 의도 동사·조사만 흡수, 주제 명사는 보존 (서로 다른 주제 충돌 금지)
// ============================================================================

/** 의도 동사: 의미상 동일한 "소개 요청" → 단일 토큰으로 흡수 */
const INTRO_INTENT_TOKENS = new Set([
  '소개',
  '소개해줘',
  '소개해',
  '설명',
  '설명해줘',
  '설명해',
  '무엇',
  '무엇인지',
  '뭐야',
  '뭔지',
  'introduce',
  'explain',
  'overview',
  'what',
  'about',
]);

/** 흡수된 의도어를 대표하는 canonical 토큰 */
const INTRO_INTENT_CANONICAL = '__intro__';

/**
 * 화이트리스트 한국어 조사 (긴 것 우선 매칭).
 * 단순 suffix 제거의 오작동을 막기 위해 화이트리스트 + 최소 어간 길이 가드와 함께 사용.
 */
const KOREAN_PARTICLES = [
  '이라는',
  '이란',
  '에서',
  '으로',
  '과',
  '와',
  '의',
  '을',
  '를',
  '은',
  '는',
  '이',
  '가',
  '에',
  '로',
  '란',
];

/** 어간이 최소 2글자 이상 남을 때만 화이트리스트 조사를 제거한다. */
const MIN_STEM_LENGTH = 2;

function stripKoreanParticle(token: string): string {
  // 한글로 끝나는 토큰만 대상 (영문/숫자 토큰은 조사 없음)
  if (!/[가-힣]$/.test(token)) {
    return token;
  }
  for (const particle of KOREAN_PARTICLES) {
    if (
      token.length - particle.length >= MIN_STEM_LENGTH &&
      token.endsWith(particle)
    ) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

/**
 * intro 질의 전용 캐시 키 정규화.
 * 공용 정규화(normalizeSemanticCacheQuery) 위에 조사 분리 + 의도어 흡수를 더해
 * "HAProxy 소개해줘 / 설명해줘 / 가 뭐야 / 가 무엇인지 소개해줘"가 단일 키로 수렴하게 한다.
 */
export function normalizeIntroCacheQuery(query: string): string {
  const base = normalizeSemanticCacheQuery(query);
  if (!base) {
    return '';
  }

  const tokens = base
    .split(' ')
    .map(stripKoreanParticle)
    .map((token) =>
      INTRO_INTENT_TOKENS.has(token) ? INTRO_INTENT_CANONICAL : token
    )
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return base;
  }

  return Array.from(new Set(tokens)).sort().join(' ');
}
