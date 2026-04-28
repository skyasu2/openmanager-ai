export const QUERY_TYPES = [
  'STATUS_SUMMARY',
  'RANK_QUERY',
  'THRESHOLD_QUERY',
  'SIMPLE_LOOKUP',
] as const;

export type QueryType = (typeof QUERY_TYPES)[number];

const SERVER_ID_PATTERN =
  /\b(?:web|api|app|was|db|cache|redis|storage|nas|lb|haproxy|nginx)[a-z0-9-]*-dc\d[a-z0-9-]*\b/i;

const THRESHOLD_PATTERNS = [
  /\d+(?:\.\d+)?\s*%?\s*(?:를|이|가|은|는)?\s*(?:이상|이하|초과|미만|넘|보다)/i,
  /(?:임계값|threshold)/i,
];

const RANK_PATTERNS = [
  /(?:가장|제일)\s*(?:높|낮|많|적)/i,
  /(?:상위|하위)\s*\d*/i,
  /\btop\s*\d*\b/i,
  /순위|랭킹|ranking/i,
];

const STATUS_SUMMARY_PATTERNS = [
  /(?:모든|전체)\s*(?:서버)?\s*(?:현황|상태|요약|목록)/i,
  /(?:서버\s*)?(?:현황|요약)\s*(?:요약|해|알려|보여)?/i,
  /서버\s*상태\s*(?:요약|전체|알려|보여)/i,
  /(?:이상|문제|장애|경고|비상|오프라인)\s*(?:서버|노드)/i,
  /간단히|핵심|tl;?dr|summary/i,
];

function hasAnyPattern(query: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(query));
}

export function classifyQueryType(query: string): QueryType {
  const normalized = query.trim();

  if (normalized.length === 0) {
    return 'SIMPLE_LOOKUP';
  }

  if (hasAnyPattern(normalized, THRESHOLD_PATTERNS)) {
    return 'THRESHOLD_QUERY';
  }

  if (hasAnyPattern(normalized, RANK_PATTERNS)) {
    return 'RANK_QUERY';
  }

  if (
    !SERVER_ID_PATTERN.test(normalized) &&
    hasAnyPattern(normalized, STATUS_SUMMARY_PATTERNS)
  ) {
    return 'STATUS_SUMMARY';
  }

  return 'SIMPLE_LOOKUP';
}
