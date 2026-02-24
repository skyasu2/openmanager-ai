import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config-parser';
import { embedText, toVectorString } from './embedding';
import { logger } from './logger';
import type { OTelResourceCatalog } from '../types/otel-metrics';

const TOPOLOGY_SOURCE_REF = 'otel-resource-catalog:current-topology';
const TOPOLOGY_TITLE = '현재 인프라 구성 토폴로지 스냅샷';
const TOPOLOGY_TAGS = ['topology', 'architecture', 'resource-catalog', 'runtime'];

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
  serverTypes: string[];
  metadata: Record<string, unknown>;
}

interface ExistingTopologyDoc {
  id: string;
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

function buildTopologyDocument(catalog: OTelResourceCatalog): TopologyDocument {
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

  const roleDetails = [...roleCounts.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((role) => {
      const ids = entries
        .filter(([, attrs]) => String(attrs['server.role'] || 'unknown') === role)
        .map(([id]) => id)
        .join(', ');
      return `${role}=[${ids}]`;
    })
    .join(' | ');

  const content = [
    `기준 시각: ${catalog.generatedAt}`,
    `총 서버 수: ${serverIds.length}대`,
    `역할 분포: ${formatCountMap(roleCounts)}`,
    '대표 트래픽 경로: loadbalancer -> web -> application -> database (cache/storage 연계)',
    `역할별 서버 목록: ${roleDetails}`,
    `리전 분포: ${formatCountMap(regionCounts)}`,
    `가용영역 분포: ${formatCountMap(zoneCounts)}`,
    `환경 분포: ${formatCountMap(envCounts)}`,
    `전체 서버 ID: ${serverIds.join(', ')}`,
    '운영 규칙: 토폴로지 질의는 본 문서를 우선 참조하고, 실시간 지표는 getServerMetrics 계열 도구로 교차 검증.',
  ].join('\n');

  const fingerprintPayload = JSON.stringify({
    generatedAt: catalog.generatedAt,
    entries: entries.map(([id, attrs]) => ({
      id,
      role: attrs['server.role'],
      region: attrs['cloud.region'],
      zone: attrs['cloud.availability_zone'],
      env: attrs['deployment.environment.name'],
    })),
  });
  const sourceHash = computeHash(fingerprintPayload);

  return {
    title: TOPOLOGY_TITLE,
    content,
    serverTypes: [...new Set(roles)].sort((a, b) => a.localeCompare(b)),
    metadata: {
      source_ref: TOPOLOGY_SOURCE_REF,
      source_type: 'topology_resource_catalog',
      source_hash: sourceHash,
      source_generated_at: catalog.generatedAt,
      server_count: serverIds.length,
      role_counts: Object.fromEntries(roleCounts.entries()),
      region_counts: Object.fromEntries(regionCounts.entries()),
      az_counts: Object.fromEntries(zoneCounts.entries()),
      injected_by: 'topology-rag-injector',
      injected_at: new Date().toISOString(),
    },
  };
}

async function findExistingTopologyDoc(
  supabase: SupabaseClient
): Promise<ExistingTopologyDoc | null> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, metadata')
    .eq('category', 'architecture')
    .filter('metadata->>source_ref', 'eq', TOPOLOGY_SOURCE_REF)
    .limit(1);

  if (error) {
    logger.warn('[TopologyRAG] Existing doc lookup failed:', error);
    return null;
  }

  const first = Array.isArray(data) ? data[0] : null;
  if (!first || !first.id) return null;

  return {
    id: String(first.id),
    metadata:
      first.metadata && typeof first.metadata === 'object'
        ? (first.metadata as Record<string, unknown>)
        : undefined,
  };
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
    const doc = buildTopologyDocument(catalog);
    const sourceHash = String(doc.metadata.source_hash || '');
    const existing = await findExistingTopologyDoc(supabase);
    const existingHash = String(existing?.metadata?.source_hash || '');

    if (existing && existingHash && existingHash === sourceHash) {
      result.success = true;
      result.skipped = 1;
      return result;
    }

    const embedding = await embedText(`${doc.title}\n\n${doc.content}`);
    const vectorString = toVectorString(embedding);

    if (existing) {
      const { error } = await supabase
        .from('knowledge_base')
        .update({
          title: doc.title,
          content: doc.content,
          embedding: vectorString,
          category: 'architecture',
          tags: TOPOLOGY_TAGS,
          severity: 'info',
          source: 'imported',
          related_server_types: doc.serverTypes,
          metadata: doc.metadata,
        })
        .eq('id', existing.id);

      if (error) {
        result.failed = 1;
        result.error = error.message;
        return result;
      }
    } else {
      const { error } = await supabase.from('knowledge_base').insert({
        title: doc.title,
        content: doc.content,
        embedding: vectorString,
        category: 'architecture',
        tags: TOPOLOGY_TAGS,
        severity: 'info',
        source: 'imported',
        related_server_types: doc.serverTypes,
        metadata: doc.metadata,
      });

      if (error) {
        result.failed = 1;
        result.error = error.message;
        return result;
      }
    }

    result.success = true;
    result.synced = 1;
    return result;
  } catch (error) {
    result.failed = 1;
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

export default { syncTopologyToRAG };
