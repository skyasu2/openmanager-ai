import {
  createRetrievalMetadata,
  legacyRagSourcesToEvidenceCards,
  type EvidenceCard,
  type EvidenceSourceType,
  type RetrievalMetadata,
} from '../../../lib/retrieval-contract';
import type { InternalDisclosureMode } from '../internal-disclosure-policy';
import { buildKnowledgeBaseGroundedAnswer } from '../supervisor-stream-citations';

export interface DirectKnowledgeResultItem {
  id?: string;
  title: string;
  content: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
}

export interface DirectKnowledgeSearchResult {
  success: boolean;
  results: DirectKnowledgeResultItem[];
  totalFound: number;
  evidenceCards: EvidenceCard[];
  retrieval?: RetrievalMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDirectKnowledgeResultItem(
  value: unknown
): DirectKnowledgeResultItem | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === 'string' ? value.title : '';
  const content = typeof value.content === 'string' ? value.content : '';
  const similarity = toNumber(value.similarity) ?? 0;
  const sourceType =
    typeof value.sourceType === 'string' ? value.sourceType : 'knowledge';

  if (!title || !content) {
    return null;
  }

  return {
    ...(typeof value.id === 'string' && { id: value.id }),
    title,
    content,
    similarity,
    sourceType,
    category: typeof value.category === 'string' ? value.category : undefined,
    url: typeof value.url === 'string' ? value.url : undefined,
  };
}

function asEvidenceSourceType(value: unknown): EvidenceSourceType {
  return value === 'incident' ||
    value === 'runbook' ||
    value === 'web' ||
    value === 'knowledge'
    ? value
    : 'knowledge';
}

export function asEvidenceCard(value: unknown): EvidenceCard | null {
  if (!isRecord(value)) return null;

  const title = typeof value.title === 'string' ? value.title : '';
  const summary = typeof value.summary === 'string' ? value.summary : '';
  const score = toNumber(value.score) ?? 0;

  if (!title || !summary) {
    return null;
  }

  return {
    id: typeof value.id === 'string' ? value.id : `evidence-${title}`,
    title,
    summary,
    sourceType: asEvidenceSourceType(value.sourceType),
    score: Math.min(1, Math.max(0, score)),
    ...(typeof value.category === 'string' && { category: value.category }),
    ...(typeof value.reason === 'string' && { reason: value.reason }),
    ...(typeof value.url === 'string' && { url: value.url }),
  };
}

export function asRetrievalMetadata(
  value: unknown
): RetrievalMetadata | undefined {
  if (!isRecord(value)) return undefined;

  return createRetrievalMetadata({
    retrievalEnabled: value.retrievalEnabled === true,
    retrievalUsed:
      typeof value.retrievalUsed === 'boolean'
        ? value.retrievalUsed
        : undefined,
    retrievalMode:
      value.retrievalMode === 'off' ||
      value.retrievalMode === 'lite' ||
      value.retrievalMode === 'text-only' ||
      value.retrievalMode === 'cosine-neighbor'
        ? value.retrievalMode
        : 'lite',
    evidenceCount: toNumber(value.evidenceCount) ?? 0,
    webUsed: value.webUsed === true,
    suppressedReason:
      value.suppressedReason === 'disabled' ||
      value.suppressedReason === 'not_needed' ||
      value.suppressedReason === 'no_results' ||
      value.suppressedReason === 'budget_guard' ||
      value.suppressedReason === 'unavailable'
        ? value.suppressedReason
        : undefined,
  });
}

export function asDirectKnowledgeSearchResult(
  value: unknown
): DirectKnowledgeSearchResult | null {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.results)) {
    return null;
  }

  const results = value.results
    .map(asDirectKnowledgeResultItem)
    .filter((item): item is DirectKnowledgeResultItem => item !== null);

  return {
    success: true,
    results,
    totalFound: toNumber(value.totalFound) ?? results.length,
    evidenceCards: Array.isArray(value.evidenceCards)
      ? value.evidenceCards
          .map(asEvidenceCard)
          .filter((item): item is EvidenceCard => item !== null)
      : [],
    retrieval: asRetrievalMetadata(value.retrieval),
  };
}

function extractServerCountHint(results: DirectKnowledgeResultItem[]): number | null {
  for (const result of results) {
    const match = result.content.match(/총\s*(\d+)\s*대/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function buildTopologyDirectKnowledgeResponse(
  query: string,
  results: DirectKnowledgeResultItem[]
): string {
  const topResults = results.slice(0, 3);
  const sourceSummary = {
    knowledge: results.filter((item) => item.sourceType === 'knowledge').length,
    incident: results.filter((item) => item.sourceType === 'incident').length,
    runbook: results.filter((item) => item.sourceType === 'runbook').length,
    web: results.filter((item) => item.sourceType === 'web').length,
  };
  const serverCountHint = extractServerCountHint(results);
  const titleBullets = topResults
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join('\n');

  return [
    '### 인프라 토폴로지 요약',
    `- 질의: ${query}`,
    `- 근거 문서: ${results.length}건 (운영 지식 ${sourceSummary.knowledge}, 장애 이력 ${sourceSummary.incident}, 런북 ${sourceSummary.runbook}, 웹 ${sourceSummary.web})`,
    serverCountHint !== null
      ? `- 확인된 서버 규모 힌트: 총 ${serverCountHint}대`
      : '- 서버 규모는 KB 문서 기준으로 파악되며, 실시간 수치는 별도 조회가 필요합니다.',
    '',
    '#### 문제/원인 관점',
    '- 이번 요청은 장애 원인 진단보다 현재 구성/트래픽 경로 확인 목적입니다.',
    '- 원인 분석이 필요하면 `findRootCause`/`correlateMetrics` 기반 추가 점검이 필요합니다.',
    '',
    '#### 핵심 근거 문서',
    titleBullets,
    '',
    '#### 해결/권장 조치',
    '1. `getServerMetrics`로 LB→WEB→APP→DB 구간의 현재 부하(CPU/메모리)를 즉시 확인하세요.',
    '2. `getServerLogs`로 WEB/APP 계층 에러 로그를 교차 점검해 병목 지점을 좁히세요.',
    '3. 토폴로지 변경 전에는 관련 runbook과 최근 incident 유사 사례를 함께 검토하세요.',
  ].join('\n');
}

export function shouldUseGroundedKnowledgeAnswer(query: string): boolean {
  return /ssot|single\s*source\s*of\s*truth|pre-generated|파일\s*경로|코드\s*위치|데이터\s*로더|data\s*loader|(?:문서|파일|경로|위치|path)/i.test(
    query
  );
}

export function resolveDirectKnowledgeEvidenceCards({
  parsedDirectResult,
  directEvidence,
  evidenceBudget,
}: {
  parsedDirectResult: DirectKnowledgeSearchResult;
  directEvidence: DirectKnowledgeResultItem[];
  evidenceBudget: number;
}): EvidenceCard[] {
  return parsedDirectResult.evidenceCards.length > 0
    ? parsedDirectResult.evidenceCards.slice(0, evidenceBudget)
    : legacyRagSourcesToEvidenceCards(
        directEvidence.map((item) => ({
          title: item.title,
          similarity: item.similarity,
          sourceType: item.sourceType,
          category: item.category,
          url: item.url,
        }))
      );
}

export function buildGroundedNoEvidenceResponse({
  query,
  directSearchResult,
  internalDisclosureMode,
}: {
  query: string;
  directSearchResult: unknown;
  internalDisclosureMode?: InternalDisclosureMode;
}): string {
  return (
    buildKnowledgeBaseGroundedAnswer(
      query,
      [{ toolName: 'searchKnowledgeBase', result: directSearchResult }],
      { internalDisclosureMode }
    ) ??
    [
      '내부 근거를 찾지 못했습니다.',
      `- 질의: ${query}`,
      '- 정확한 repo 경로, 문서명, 운영 파일 위치는 추정하지 않습니다.',
    ].join('\n')
  );
}
