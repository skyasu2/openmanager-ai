import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { logger } from '../../../lib/logger';
import { createRetrievalMetadata } from '../../../lib/retrieval-contract';
import type { MultiAgentResponse } from './orchestrator-types';
import { evaluateAgentResponseQuality } from './response-quality';

interface ResourceCatalog {
  resources?: Record<string, Record<string, unknown>>;
}

interface StructuredTopologySnapshot {
  totalServers: number;
  roleCounts: Map<string, number>;
  azCounts: Map<string, number>;
  roleGroups: Array<{ role: string; serverIds: string[] }>;
  statusCounts: Record<string, number>;
  alertCount: number;
  dataSources: string[];
}

interface ResourceCatalogCache {
  filePath: string | null;
  catalog: ResourceCatalog | null;
}

let resourceCatalogCache: ResourceCatalogCache | undefined;

const STRUCTURED_TOPOLOGY_BOUNDARY_PATTERN =
  /서버\s*(수|몇|목록|리스트|역할|role|상태|status)|몇\s*대|role|az|가용\s*영역|availability\s*zone|inventory|인벤토리/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function formatCountMap(map: Map<string, number>): string {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}: ${count}`)
    .join(', ');
}

function compactServerIds(serverIds: string[]): string {
  return serverIds.slice().sort((left, right) => left.localeCompare(right)).join(', ');
}

function getStateServers(stateData: unknown): Array<{ id: string; status: string }> {
  if (!isRecord(stateData) || !Array.isArray(stateData.servers)) {
    return [];
  }

  return stateData.servers
    .filter((server): server is Record<string, unknown> => isRecord(server) && typeof server.id === 'string')
    .map((server) => ({
      id: server.id as string,
      status: typeof server.status === 'string' ? server.status : 'unknown',
    }));
}

function getStateAlertCount(
  stateData: unknown,
  servers: Array<{ status: string }>
): number {
  if (isRecord(stateData) && Array.isArray(stateData.alerts)) {
    return stateData.alerts.length;
  }

  return servers.filter((server) =>
    ['warning', 'critical', 'offline'].includes(server.status)
  ).length;
}

function loadResourceCatalog(): ResourceCatalog | null {
  const candidates = [
    // Prefer the tracked OTel SSOT so local generated copies cannot mask CI drift.
    join(process.cwd(), 'public/data/otel-data/resource-catalog.json'),
    join(process.cwd(), '..', '..', 'public/data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'cloud-run/ai-engine/data/otel-data/resource-catalog.json'),
  ];
  const firstExistingCandidate =
    candidates.find((filePath) => existsSync(filePath)) ?? null;

  if (
    resourceCatalogCache !== undefined &&
    resourceCatalogCache.filePath === firstExistingCandidate
  ) {
    return resourceCatalogCache.catalog;
  }

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const catalog = JSON.parse(
        readFileSync(filePath, 'utf-8')
      ) as ResourceCatalog;
      resourceCatalogCache = { filePath, catalog };
      return catalog;
    } catch (error) {
      logger.warn(
        `[Forced Routing] Failed to parse resource catalog ${filePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  resourceCatalogCache = { filePath: null, catalog: null };
  return null;
}

function buildStructuredTopologySnapshot(
  stateData?: unknown
): StructuredTopologySnapshot | null {
  const catalog = loadResourceCatalog();
  const resources = catalog?.resources;
  if (!resources || Object.keys(resources).length === 0) {
    return null;
  }
  const stateServers = getStateServers(stateData);
  if (stateServers.length === 0) {
    return null;
  }

  const roleCounts = new Map<string, number>();
  const azCounts = new Map<string, number>();
  const roleGroups = new Map<string, string[]>();

  for (const [serverId, attrs] of Object.entries(resources)) {
    const role = readString(attrs['server.role']) ?? 'unknown';
    const az = readString(attrs['cloud.availability_zone']) ?? 'unknown';
    incrementCount(roleCounts, role);
    incrementCount(azCounts, az);
    roleGroups.set(role, [...(roleGroups.get(role) ?? []), serverId]);
  }

  const statusCounts = stateServers.reduce<Record<string, number>>(
    (acc, server) => {
      acc[server.status] = (acc[server.status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return {
    totalServers: Object.keys(resources).length,
    roleCounts,
    azCounts,
    roleGroups: [...roleGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([role, serverIds]) => ({ role, serverIds: serverIds.sort() })),
    statusCounts,
    alertCount: getStateAlertCount(stateData, stateServers),
    dataSources: ['otel-resource-catalog', 'domain-data-source'],
  };
}

export function isStructuredTopologyBoundaryQuery(query: string): boolean {
  return STRUCTURED_TOPOLOGY_BOUNDARY_PATTERN.test(query);
}

export function buildStructuredTopologyBoundaryResponse(
  query: string,
  startTime: number,
  suggestedAgentName: string,
  ragEnabled: boolean,
  stateData?: unknown
): MultiAgentResponse | null {
  const snapshot = buildStructuredTopologySnapshot(stateData);
  if (!snapshot) return null;

  const roleGroupLines = snapshot.roleGroups
    .map(({ role, serverIds }) => `- ${role}: ${compactServerIds(serverIds)}`)
    .join('\n');
  const statusSummary = Object.entries(snapshot.statusCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');
  const response = sanitizeChineseCharacters(
    [
      '### 인프라 구조화 상태 요약',
      `- 질의: ${query}`,
      `- 총 서버 수: ${snapshot.totalServers}대`,
      `- 역할 분포: ${formatCountMap(snapshot.roleCounts)}`,
      `- AZ 분포: ${formatCountMap(snapshot.azCounts)}`,
      `- 현재 상태 요약: ${statusSummary || '상태 데이터 없음'}`,
      `- 현재 알림 수: ${snapshot.alertCount}건`,
      '',
      '#### 역할별 서버',
      roleGroupLines,
      '',
      '#### 근거 경계',
      '- 서버 수, 역할, AZ, 현재 상태는 RAG 문서가 아니라 구조화된 OTel resource catalog와 도메인 dataSource를 정본으로 사용했습니다.',
      '- 운영 절차나 장애 대응 방법이 필요하면 내부 지식 검색을 보조 근거로 별도 사용합니다.',
    ].join('\n')
  );
  const durationMs = Date.now() - startTime;
  const quality = evaluateAgentResponseQuality(suggestedAgentName, response, {
    durationMs,
  });

  return {
    success: true,
    response,
    evidenceCards: [
      {
        id: 'structured-topology-current-state',
        title: 'Structured topology and current metrics state',
        summary: `${snapshot.totalServers} servers from resource catalog; current status from precomputed state.`,
        sourceType: 'knowledge',
        score: 1,
        category: 'structured-topology',
        reason: `structured-evidence:${snapshot.dataSources.join('+')}`,
      },
    ],
    handoffs: [
      {
        from: 'Orchestrator',
        to: suggestedAgentName,
        reason: 'Forced routing (structured topology boundary)',
      },
    ],
    finalAgent: suggestedAgentName,
    toolsCalled: ['structuredTopologyLookup', 'finalAnswer'],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    },
    metadata: {
      provider: 'deterministic',
      modelId: 'structured-topology-state',
      totalRounds: 1,
      handoffCount: 1,
      durationMs,
      responseChars: quality.responseChars,
      formatCompliance: quality.formatCompliance,
      qualityFlags: quality.qualityFlags,
      latencyTier: quality.latencyTier,
      retrieval: createRetrievalMetadata({
        retrievalEnabled: ragEnabled,
        retrievalUsed: false,
        retrievalMode: 'lite',
        evidenceCount: 0,
        suppressedReason: 'not_needed',
        webUsed: false,
      }),
    },
  };
}
