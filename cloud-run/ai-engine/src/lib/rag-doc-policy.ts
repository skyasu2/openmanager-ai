export const TARGET_DOC_CHAR_MIN = 280;
export const TARGET_DOC_CHAR_MAX = 520;
export const HARD_DOC_CHAR_MAX = 600;
export const DEFAULT_TARGET_TOTAL_DOCS = 42;

export const MERGE_SIMILARITY_THRESHOLD = 0.82;

export const CATEGORY_MIN_COUNTS: Record<string, number> = {
  command: 16,
  incident: 8,
  best_practice: 8,
  troubleshooting: 3,
  architecture: 2,
  security: 1,
};

export const SOURCE_PRIORITY: Record<string, number> = {
  auto_generated: 0,
  command_vectors_migration: 1,
  seed_script: 2,
  manual: 3,
  imported: 4,
  unknown: 5,
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeTextForSimilarity(value: string): string {
  return normalizeWhitespace(value.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ' '));
}

export function tokenizeForSimilarity(value: string): string[] {
  return normalizeTextForSimilarity(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

const BOILERPLATE_PATTERNS = [
  /운영\s*모니터링\s*맥락/i,
  /이\s*명령은\s*command\s*장애\s*분석/i,
  /실행\s*전\/후\s*지표/i,
  /단일\s*결과로\s*결론/i,
  /안전\s*체크리스트/i,
];

export function sanitizeContentForSimilarity(value: string): string {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)));
  return lines.join(' ');
}

export function jaccardSimilarity(left: string, right: string): number {
  const leftSet = new Set(tokenizeForSimilarity(left));
  const rightSet = new Set(tokenizeForSimilarity(right));

  if (leftSet.size === 0 && rightSet.size === 0) {
    return 1;
  }

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = leftSet.size + rightSet.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function computeTitleSimilarity(titleA: string, titleB: string): number {
  return jaccardSimilarity(titleA, titleB);
}

export function computeContentSimilarity(contentA: string, contentB: string): number {
  const sanitizedLeft = sanitizeContentForSimilarity(contentA).slice(0, 320);
  const sanitizedRight = sanitizeContentForSimilarity(contentB).slice(0, 320);
  return jaccardSimilarity(sanitizedLeft, sanitizedRight);
}

export function computeDocumentSimilarity(
  titleA: string,
  contentA: string,
  titleB: string,
  contentB: string
): number {
  const titleScore = computeTitleSimilarity(titleA, titleB);
  const contentScore = computeContentSimilarity(contentA, contentB);

  return Number((titleScore * 0.65 + contentScore * 0.35).toFixed(4));
}

export function trimToHardLimit(content: string, maxChars = HARD_DOC_CHAR_MAX): string {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const trimmed = normalized.slice(0, Math.max(0, maxChars - 1)).trim();
  return `${trimmed}…`;
}

export function severityRank(value: string): number {
  switch (value.toLowerCase()) {
    case 'critical':
      return 3;
    case 'warning':
    case 'high':
      return 2;
    case 'info':
    case 'low':
    default:
      return 1;
  }
}
