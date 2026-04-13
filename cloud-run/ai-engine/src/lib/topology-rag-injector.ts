import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config-parser';
import { embedText, toVectorString } from './embedding';
import { logger } from './logger';
import type { OTelResourceCatalog } from '../types/otel-metrics';

const LEGACY_TOPOLOGY_SOURCE_REF = 'otel-resource-catalog:current-topology';
const LEGACY_TOPOLOGY_TITLE = '현재 인프라 구성 토폴로지 스냅샷';
const TOPOLOGY_TAGS = ['topology', 'architecture', 'resource-catalog', 'runtime'];
const TOPOLOGY_DOC_SPECS = [
  {
    title: '현재 인프라 역할/트래픽 토폴로지 스냅샷',
    sourceRef: 'otel-resource-catalog:topology-role-traffic',
    extraTags: ['traffic-flow', 'server-roles'],
  },
  {
    title: '현재 인프라 배치/운영 검증 스냅샷',
    sourceRef: 'otel-resource-catalog:topology-placement-operations',
    extraTags: ['placement', 'governance'],
  },
] as const;
const ROLE_LABELS: Record<string, string> = {
  application: 'APP',
  cache: 'CACHE',
  database: 'DB',
  loadbalancer: 'LB',
  storage: 'STORAGE',
  web: 'WEB',
};

let supabaseClient: SupabaseClient | null = null;
let initFailed = false;

interface TopologyRagSyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  failed: number;
  error?: string;
}

interface TopologyDocument {
  title: string;
  content: string;
  sourceRef: string;
  tags: string[];
  serverTypes: string[];
  metadata: Record<string, unknown>;
}

interface ExistingTopologyDoc {
  id: string;
  title: string;
  metadata?: Record<string, unknown>;
}

function getSupabaseClient(): SupabaseClient | null {
  if (initFailed) return null;
  if (supabaseClient) return supabaseClient;

  const config = getSupabaseConfig();
  if (!config) {
    initFailed = true;
    logger.warn('[TopologyRAG] Supabase config missing');
    return null;
  }

  try {
    supabaseClient = createClient(config.url, config.serviceRoleKey);
    return supabaseClient;
  } catch (error) {
    initFailed = true;
    logger.error('[TopologyRAG] Supabase init failed:', error);
    return null;
  }
}

function getResourceCatalogPaths(): string[] {
  return [
    join(__dirname, '../../data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'cloud-run/ai-engine/data/otel-data/resource-catalog.json'),
    join(process.cwd(), 'public/data/otel-data/resource-catalog.json'),
  ];
}

function loadResourceCatalog(): OTelResourceCatalog | null {
  for (const filePath of getResourceCatalogPaths()) {
    if (!existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as OTelResourceCatalog;
      if (!parsed?.resources || typeof parsed.resources !== 'object') continue;
      logger.info({ filePath }, '[TopologyRAG] Loaded resource catalog');
      return parsed;
    } catch (error) {
      logger.warn({ filePath, error }, '[TopologyRAG] Failed to parse resource catalog');
    }
  }
  return null;
}

function countBy<T>(items: T[]): Map<T, number> {
  const map = new Map<T, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
}

function formatCountMap(map: Map<string, number>): string {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key} ${value}대`)
    .join(', ');
}

function computeHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function compactServerIds(ids: string[]): string {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  if (sorted.length <= 1) {
    return sorted[0] || '';
  }

  let prefix = sorted[0];
  for (const value of sorted.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) {
      i += 1;
    }
    prefix = prefix.slice(0, i);
  }

  const lastHyphen = prefix.lastIndexOf('-');
  if (lastHyphen <= 0) {
    return sorted.join('/');
  }

  const groupedPrefix = prefix.slice(0, lastHyphen + 1);
  const suffixes = sorted.map((value) => value.slice(groupedPrefix.length)).filter(Boolean);
  if (suffixes.length !== sorted.length) {
    return sorted.join('/');
  }

  return `${groupedPrefix}[${suffixes.join(',')}]`;
}

function buildTopologyDocuments(catalog: OTelResourceCatalog): TopologyDocument[] {
  const entries = Object.entries(catalog.resources).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const serverIds = entries.map(([serverId]) => serverId);
  const roles = entries.map(([, attrs]) => String(attrs['server.role'] || 'unknown'));
  const regions = entries.map(([, attrs]) => String(attrs['cloud.region'] || 'unknown'));
  const zones = entries.map(([, attrs]) =>
    String(attrs['cloud.availability_zone'] || 'unknown')
  );
  const envs = entries.map(([, attrs]) =>
    String(attrs['deployment.environment.name'] || 'unknown')
  );

  const roleCounts = countBy(roles);
  const regionCounts = countBy(regions);
  const zoneCounts = countBy(zones);
  const envCounts = countBy(envs);

  const roleGroups = [...roleCounts.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((role) => {
      const ids = entries
        .filter(([, attrs]) => String(attrs['server.role'] || 'unknown') === role)
        .map(([id]) => id);
      return `${ROLE_LABELS[role] || role} ${compactServerIds(ids)}`;
    })
    .join(' | ');

  const commonMetadata = {
    source_type: 'topology_resource_catalog',
    source_generated_at: catalog.generatedAt,
    server_count: serverIds.length,
    role_counts: Object.fromEntries(roleCounts.entries()),
    region_counts: Object.fromEntries(regionCounts.entries()),
    az_counts: Object.fromEntries(zoneCounts.entries()),
    environment_counts: Object.fromEntries(envCounts.entries()),
    injected_by: 'topology-rag-injector',
    injected_at: new Date().toISOString(),
  };
  const serverTypes = [...new Set(roles)].sort((a, b) => a.localeCompare(b));
  const roleTrafficContent = [
    `기준 시각: ${catalog.generatedAt}`,
    `총 서버 수: ${serverIds.length}대. 역할 분포: ${formatCountMap(roleCounts)}.`,
    `역할별 서버 묶음: ${roleGroups}.`,
    '대표 트래픽 경로: loadbalancer -> web -> application -> database, cache/storage 연계.',
    '운영 메모: 토폴로지 질문은 역할 흐름 기준으로 해석하고, 병목·경보는 getServerMetrics와 dashboard metric으로 다시 확인한다.',
  ].join('\n');
  const placementOpsContent = [
    `기준 시각: ${catalog.generatedAt}`,
    `배치 요약: 리전 ${formatCountMap(regionCounts)}, 가용영역 ${formatCountMap(zoneCounts)}, 환경 ${formatCountMap(envCounts)}.`,
    '인벤토리 구조: 동일 역할 서버를 다중 AZ에 나눠 배치해 loadbalancer, web, application, database 계층의 단일 장애점을 줄인다.',
    '운영 규칙: 본 문서는 정적 배치 anchor다. 실시간 상태, 자원 사용률, AI 답변의 수치 근거는 OTel snapshot과 API 응답으로 다시 확인하고 단독 근거로 장애를 확정하지 않는다.',
  ].join('\n');

  return TOPOLOGY_DOC_SPECS.map((spec, index) => {
    const content = index === 0 ? roleTrafficContent : placementOpsContent;
    return {
      title: spec.title,
      content,
      sourceRef: spec.sourceRef,
      tags: [...TOPOLOGY_TAGS, ...spec.extraTags],
      serverTypes,
      metadata: {
        ...commonMetadata,
        source_ref: spec.sourceRef,
        source_hash: computeHash(
          JSON.stringify({
            sourceRef: spec.sourceRef,
            content,
            serverTypes,
          })
        ),
      },
    };
  });
}

function getExistingSourceRef(doc: ExistingTopologyDoc): string {
  return String(doc.metadata?.source_ref || '');
}

function isKnownTopologyDoc(doc: ExistingTopologyDoc): boolean {
  const currentSourceRef = getExistingSourceRef(doc);
  if (
    currentSourceRef === LEGACY_TOPOLOGY_SOURCE_REF ||
    TOPOLOGY_DOC_SPECS.some((spec) => spec.sourceRef === currentSourceRef)
  ) {
    return true;
  }

  return (
    doc.title === LEGACY_TOPOLOGY_TITLE ||
    TOPOLOGY_DOC_SPECS.some((spec) => spec.title === doc.title)
  );
}

async function findExistingTopologyDocs(
  supabase: SupabaseClient
) : Promise<ExistingTopologyDoc[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, title, metadata')
    .eq('category', 'architecture');

  if (error) {
    logger.warn('[TopologyRAG] Existing doc lookup failed:', error);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data
    .filter((doc) => doc?.id && doc?.title)
    .map((doc) => ({
      id: String(doc.id),
      title: String(doc.title),
      metadata:
        doc.metadata && typeof doc.metadata === 'object'
          ? (doc.metadata as Record<string, unknown>)
          : undefined,
    }))
    .filter(isKnownTopologyDoc);
}

export async function syncTopologyToRAG(): Promise<TopologyRagSyncResult> {
  const result: TopologyRagSyncResult = {
    success: false,
    synced: 0,
    skipped: 0,
    failed: 0,
  };

  const supabase = getSupabaseClient();
  if (!supabase) {
    result.error = 'Supabase unavailable';
    result.failed = 1;
    return result;
  }

  const catalog = loadResourceCatalog();
  if (!catalog) {
    result.error = 'resource-catalog.json not found';
    result.skipped = 1;
    result.success = true;
    return result;
  }

  try {
    const docs = buildTopologyDocuments(catalog);
    const existingDocs = await findExistingTopologyDocs(supabase);
    const bySourceRef = new Map<string, ExistingTopologyDoc[]>();
    const byTitle = new Map<string, ExistingTopologyDoc[]>();
    const reusableLegacy: ExistingTopologyDoc[] = [];
    const consumedIds = new Set<string>();
    const obsoleteIds = new Set<string>();

    for (const existing of existingDocs) {
      const sourceRef = getExistingSourceRef(existing);
      if (TOPOLOGY_DOC_SPECS.some((spec) => spec.sourceRef === sourceRef)) {
        const matches = bySourceRef.get(sourceRef) ?? [];
        matches.push(existing);
        bySourceRef.set(sourceRef, matches);
      } else if (
        sourceRef === LEGACY_TOPOLOGY_SOURCE_REF ||
        existing.title === LEGACY_TOPOLOGY_TITLE
      ) {
        reusableLegacy.push(existing);
      } else {
        const matches = byTitle.get(existing.title) ?? [];
        matches.push(existing);
        byTitle.set(existing.title, matches);
      }
    }

    for (const doc of docs) {
      const currentMatches = bySourceRef.get(doc.sourceRef) ?? [];
      const titleMatches = byTitle.get(doc.title) ?? [];
      const reusableDoc =
        currentMatches.shift() ?? titleMatches.shift() ?? reusableLegacy.shift() ?? null;

      if (currentMatches.length > 0) {
        for (const extra of currentMatches) {
          obsoleteIds.add(extra.id);
        }
        bySourceRef.set(doc.sourceRef, []);
      }
      if (titleMatches.length > 0) {
        for (const extra of titleMatches) {
          obsoleteIds.add(extra.id);
        }
        byTitle.set(doc.title, []);
      }

      if (reusableDoc) {
        consumedIds.add(reusableDoc.id);
      }

      const sourceHash = String(doc.metadata.source_hash || '');
      const existingHash = String(reusableDoc?.metadata?.source_hash || '');
      const sourceRefMatches = getExistingSourceRef(reusableDoc ?? { id: '', title: '' }) === doc.sourceRef;

      if (reusableDoc && sourceRefMatches && existingHash && existingHash === sourceHash) {
        result.skipped += 1;
        continue;
      }

      const embedding = await embedText(`${doc.title}\n\n${doc.content}`);
      const vectorString = toVectorString(embedding);
      const payload = {
        title: doc.title,
        content: doc.content,
        embedding: vectorString,
        category: 'architecture',
        tags: doc.tags,
        severity: 'info',
        source: 'imported',
        related_server_types: doc.serverTypes,
        metadata: doc.metadata,
      };

      if (reusableDoc) {
        const { error } = await supabase
          .from('knowledge_base')
          .update(payload)
          .eq('id', reusableDoc.id);

        if (error) {
          result.failed = 1;
          result.error = error.message;
          return result;
        }
      } else {
        const { error } = await supabase.from('knowledge_base').insert(payload);

        if (error) {
          result.failed = 1;
          result.error = error.message;
          return result;
        }
      }

      result.synced += 1;
    }

    for (const legacy of reusableLegacy) {
      if (!consumedIds.has(legacy.id)) {
        obsoleteIds.add(legacy.id);
      }
    }
    for (const docsBySource of bySourceRef.values()) {
      for (const extra of docsBySource) {
        if (!consumedIds.has(extra.id)) {
          obsoleteIds.add(extra.id);
        }
      }
    }
    for (const docsByTitle of byTitle.values()) {
      for (const extra of docsByTitle) {
        if (!consumedIds.has(extra.id)) {
          obsoleteIds.add(extra.id);
        }
      }
    }

    if (obsoleteIds.size > 0) {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .in('id', [...obsoleteIds]);

      if (error) {
        result.failed = 1;
        result.error = error.message;
        return result;
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    result.failed = 1;
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

export default { syncTopologyToRAG };
export { buildTopologyDocuments };
