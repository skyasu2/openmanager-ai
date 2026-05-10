import {
  createRetrievalMetadata,
  type EvidenceCard,
  type EvidenceSourceType,
  type RetrievalMetadata,
} from './retrieval-contract';

export interface KnowledgeRetrievalLiteInput {
  query: string;
  category?: string;
  severity?: string;
  limit?: number;
  context?: Record<string, string | undefined>;
}

export interface KnowledgeRetrievalLiteResult {
  success: boolean;
  evidenceCards: EvidenceCard[];
  totalFound: number;
  metadata: RetrievalMetadata;
  _source: string;
  error?: string;
}

export interface KnowledgeRetrievalLiteDependencies {
  client?: {
    rpc: (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>;
  };
}

type KnowledgeTextRow = Record<string, unknown>;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const MAX_QUERY_CANDIDATES = 6;

const DOMAIN_QUERY_FALLBACKS = [
  {
    domainSignals: [
      /otel|opentelemetry|pre-generated|pre\s*generated|ssot|single\s*source\s*of\s*truth|metricsprovider|precomputed-state|public\/data\/otel-data/i,
    ],
    symptomSignals: [
      /path|경로|위치|파일|file|loader|로더|data|데이터|문서화|documented|runtime|런타임/i,
    ],
    candidates: [
      'OTel 데이터 SSOT data loader',
      'Pre-generated OTel 데이터 SSOT 파일 경로',
    ],
  },
  {
    domainSignals: [/redis|레디스|cache|캐시/i],
    symptomSignals: [/oom|out\s*of\s*memory|memory|메모리|부족/i],
    candidates: ['redis memory', 'redis oom', 'cache memory', '레디스 메모리'],
  },
  {
    domainSignals: [/memory|mem|메모리|메머리|멤/i],
    symptomSignals: [/top|high|usage|사용|사용률|높|부족|pressure|oom/i],
    candidates: ['memory', '메모리', 'memory usage', '메모리 사용률'],
  },
  {
    domainSignals: [
      /disk|storage|filesystem|\bfs\b|space|capacity|df|du|디스크|스토리지|저장소|용량/i,
    ],
    symptomSignals: [
      /cleanup|clean\s*up|free|확보|정리|부족|full|높|사용|usage|capacity|space|용량|86/i,
    ],
    candidates: ['disk', '디스크', 'disk space', 'df du', '디스크 용량 부족'],
  },
  {
    domainSignals: [/redis|레디스|cache|캐시/i],
    symptomSignals: [/connection|pool|timeout|접속|연결|타임아웃|실패/i],
    candidates: [
      'redis connection',
      'redis timeout',
      'cache connection',
      '레디스 연결',
    ],
  },
  {
    domainSignals: [/postgres|postgresql|database|\bdb\b|디비|데이터베이스/i],
    symptomSignals: [/connection|pool|timeout|접속|연결|타임아웃|실패/i],
    candidates: [
      'database connection',
      'postgres connection pool',
      'db timeout',
      '데이터베이스 연결',
      'database',
      'mysql',
    ],
  },
  {
    domainSignals: [
      /nginx|엔진엑스|gateway|proxy|\blb\b|load\s*balancer|로드밸런서/i,
    ],
    symptomSignals: [/5xx|503|502|timeout|connection|타임아웃|연결/i],
    candidates: [
      'nginx',
      'gateway',
      'nginx gateway',
      'http 5xx',
      'gateway timeout',
      '엔진엑스 장애',
    ],
  },
  {
    domainSignals: [/cpu|processor|프로세스|부하|load/i],
    symptomSignals: [/high|spike|높|과부하|지연/i],
    candidates: ['cpu', 'cpu high load', 'cpu spike', '프로세스 부하'],
  },
  {
    domainSignals: [/topology|토폴로지|architecture|아키텍처|의존성|dependency/i],
    symptomSignals: [/path|경로|구성|배치|dependency|의존|스냅샷|snapshot/i],
    candidates: ['topology', '토폴로지', 'server topology', '인프라 토폴로지'],
  },
  {
    domainSignals: [/security|보안|ssh|access|접근|인증/i],
    symptomSignals: [/incident|인시던트|check|점검|대응|access|접근|ssh|auth|인증/i],
    candidates: ['security', '보안', 'ssh access', '보안 인시던트'],
  },
] as const;

export async function retrieveKnowledgeEvidence(
  input: KnowledgeRetrievalLiteInput,
  deps: KnowledgeRetrievalLiteDependencies = {}
): Promise<KnowledgeRetrievalLiteResult> {
  const limit = normalizeLimit(input.limit);

  const client = deps.client;
  if (!client) {
    return unavailableResult('Supabase client unavailable');
  }

  try {
    const { rows, searchQuery } = await searchKnowledgeRows(
      input,
      { client },
      limit
    );

    if (rows.length === 0) {
      return {
        success: true,
        evidenceCards: [],
        totalFound: 0,
        metadata: createRetrievalMetadata({
          retrievalEnabled: true,
          retrievalUsed: false,
          retrievalMode: 'lite',
          suppressedReason: 'no_results',
          evidenceCount: 0,
          webUsed: false,
        }),
        _source: 'Knowledge Retrieval Lite (No Results)',
      };
    }

    const evidenceCards = rows
      .map((row) => mapTextRowToEvidenceCard(row, input, searchQuery))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      success: true,
      evidenceCards,
      totalFound: evidenceCards.length,
      metadata: createRetrievalMetadata({
        retrievalEnabled: true,
        retrievalUsed: evidenceCards.length > 0,
        retrievalMode: 'lite',
        evidenceCount: evidenceCards.length,
        webUsed: false,
      }),
      _source: 'Knowledge Retrieval Lite',
    };
  } catch (error) {
    return unavailableResult(getErrorMessage(error));
  }
}

async function searchKnowledgeRows(
  input: KnowledgeRetrievalLiteInput,
  deps: Required<Pick<KnowledgeRetrievalLiteDependencies, 'client'>>,
  limit: number
): Promise<{ rows: KnowledgeTextRow[]; searchQuery: string }> {
  const queryCandidates = buildSearchQueryCandidates(input.query);
  let lastSearchQuery = queryCandidates[0] ?? input.query;

  for (const searchQuery of queryCandidates) {
    lastSearchQuery = searchQuery;
    const { data, error } = await deps.client.rpc('search_knowledge_text', {
      p_query_text: searchQuery,
      p_max_results: Math.max(limit * 2, 10),
      p_filter_category: input.category ?? null,
    });

    if (error) {
      throw new Error(getErrorMessage(error));
    }

    const rows = Array.isArray(data) ? (data as KnowledgeTextRow[]) : [];
    if (rows.length > 0) {
      return { rows, searchQuery };
    }
  }

  return { rows: [], searchQuery: lastSearchQuery };
}

function mapTextRowToEvidenceCard(
  row: KnowledgeTextRow,
  input: KnowledgeRetrievalLiteInput,
  searchQuery: string
): EvidenceCard {
  const metadata = getObject(row.metadata);
  const category = readString(row.category) ?? 'knowledge';
  const textRank = readNumber(row.text_rank) ?? readNumber(row.score) ?? 0;
  const baseScore = normalizeTextRank(textRank);
  const { boost, reasons } = calculateMetadataBoost(row, metadata, input);
  const score = clampScore(baseScore + boost);
  const reason = [
    `bm25-text-rank:${baseScore.toFixed(3)}`,
    isFallbackQuery(input.query, searchQuery)
      ? `query-fallback:${searchQuery}`
      : null,
    reasons.length > 0 ? `metadata-boost:${reasons.join(',')}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  return {
    id:
      readString(row.id) ??
      `knowledge-${hashText(readString(row.title) ?? '')}`,
    title: readString(row.title) ?? 'Untitled knowledge evidence',
    summary: truncateSummary(readString(row.content) ?? ''),
    sourceType: resolveSourceType(category, metadata),
    score,
    category,
    reason,
  };
}

function calculateMetadataBoost(
  row: KnowledgeTextRow,
  metadata: Record<string, unknown>,
  input: KnowledgeRetrievalLiteInput
): { boost: number; reasons: string[] } {
  let boost = 0;
  const reasons: string[] = [];
  const tags = getStringArray(row.tags);
  const relatedServerTypes = getStringArray(row.related_server_types);
  const metadataValues = getMetadataSearchValues(metadata);
  const searchable = [
    ...tags,
    ...relatedServerTypes,
    ...metadataValues,
    readString(row.category),
    readString(row.severity),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const addBoost = (amount: number, reason: string): void => {
    boost += amount;
    reasons.push(reason);
  };

  const category = readString(row.category)?.toLowerCase();
  if (input.category && category === input.category.toLowerCase()) {
    addBoost(0.04, 'category');
  }

  const severity = readString(row.severity)?.toLowerCase();
  if (input.severity && severity === input.severity.toLowerCase()) {
    addBoost(0.06, 'severity');
  }

  const context = input.context ?? {};
  if (matchesSearchable(context.serverId, searchable)) {
    addBoost(0.12, 'serverId');
  }
  if (matchesSearchable(context.serverRole, searchable)) {
    addBoost(0.1, 'serverRole');
  }

  const queryTokenMatches = tokenize(input.query).filter((token) =>
    searchable.some((value) => value.includes(token))
  );
  if (queryTokenMatches.length > 0) {
    addBoost(Math.min(0.06, queryTokenMatches.length * 0.015), 'queryTags');
  }

  const docType = readString(metadata.docType)?.toLowerCase();
  if (
    docType === 'runbook' &&
    (input.category === 'incident' || input.category === 'troubleshooting')
  ) {
    addBoost(0.05, 'runbook');
  }

  return { boost: Math.min(boost, 0.35), reasons };
}

function buildSearchQueryCandidates(query: string): string[] {
  const primaryQuery = normalizeQueryWhitespace(query);
  const normalizedForMatch = primaryQuery.toLowerCase();
  const candidates = [primaryQuery];

  for (const fallback of DOMAIN_QUERY_FALLBACKS) {
    const domainMatched = fallback.domainSignals.some((signal) =>
      signal.test(normalizedForMatch)
    );
    const symptomMatched =
      !fallback.symptomSignals ||
      fallback.symptomSignals.some((signal) => signal.test(normalizedForMatch));

    if (domainMatched && symptomMatched) {
      candidates.push(...fallback.candidates);
    }
  }

  return dedupeQueries(candidates).slice(0, MAX_QUERY_CANDIDATES);
}

function dedupeQueries(queries: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const query of queries) {
    const normalized = normalizeQueryWhitespace(query);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

function normalizeQueryWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isFallbackQuery(originalQuery: string, searchQuery: string): boolean {
  return (
    normalizeQueryWhitespace(originalQuery).toLowerCase() !==
    normalizeQueryWhitespace(searchQuery).toLowerCase()
  );
}

function unavailableResult(error: string): KnowledgeRetrievalLiteResult {
  return {
    success: false,
    evidenceCards: [],
    totalFound: 0,
    metadata: createRetrievalMetadata({
      retrievalEnabled: true,
      retrievalUsed: false,
      retrievalMode: 'lite',
      suppressedReason: 'unavailable',
      evidenceCount: 0,
      webUsed: false,
    }),
    _source: 'Knowledge Retrieval Lite (Unavailable)',
    error,
  };
}

function resolveSourceType(
  category: string,
  metadata: Record<string, unknown>
): EvidenceSourceType {
  const docType = readString(metadata.docType)?.toLowerCase();
  const normalizedCategory = category.toLowerCase();

  if (docType === 'runbook') return 'runbook';
  if (normalizedCategory === 'incident') return 'incident';
  if (
    normalizedCategory === 'troubleshooting' ||
    normalizedCategory === 'best_practice' ||
    normalizedCategory === 'command'
  ) {
    return 'runbook';
  }
  return 'knowledge';
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit ?? DEFAULT_LIMIT)));
}

function normalizeTextRank(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  return rank <= 1 ? rank : rank / (rank + 1);
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

function truncateSummary(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return normalized.length > 700
    ? `${normalized.slice(0, 700)}...`
    : normalized;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9가-힣._-]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function matchesSearchable(
  needle: string | undefined,
  searchable: string[]
): boolean {
  if (!needle) return false;
  const normalizedNeedle = needle.toLowerCase();
  return searchable.some((value) => value.includes(normalizedNeedle));
}

function getMetadataSearchValues(metadata: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const value of Object.values(metadata)) {
    if (typeof value === 'string') {
      values.push(value);
    } else if (Array.isArray(value)) {
      values.push(
        ...value.filter((item): item is string => typeof item === 'string')
      );
    }
  }
  return values;
}

function getObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return String(error);
}

function hashText(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
