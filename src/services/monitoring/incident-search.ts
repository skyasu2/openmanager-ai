import { getAllThresholds } from '@/config/rules/loader';
import { getOTelHourlyData, getOTelResourceCatalog } from '@/data/otel-data';
import { otelSlotToServers } from '@/services/metrics/otel-direct-transform';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';
import type {
  IncidentCause,
  IncidentEvent,
  IncidentMetric,
  IncidentSeverity,
} from '@/types/incidents';

type SortOrder = 'asc' | 'desc';

export type IncidentQuery = {
  search?: string;
  severity?: IncidentSeverity;
  metric?: IncidentMetric;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortOrder?: SortOrder;
};

type IncidentIndex = {
  builtAt: number;
  windowStart: number | null;
  windowEnd: number | null;
  events: IncidentEvent[];
};

let INCIDENT_INDEX_CACHE: IncidentIndex | null = null;
const INDEX_CACHE_TTL_MS = 60_000;

function getServerId(server: EnhancedServerMetrics): string {
  return server.id || server.name || server.hostname || 'unknown';
}

function buildCauses(server: EnhancedServerMetrics): IncidentCause[] {
  const thresholds = getAllThresholds();
  const causes: IncidentCause[] = [];

  const pushCause = (
    metric: Exclude<IncidentMetric, 'composite'>,
    value: number
  ): void => {
    const metricThreshold = thresholds[metric];
    if (value < metricThreshold.warning) return;

    causes.push({
      metric,
      value,
      warningThreshold: metricThreshold.warning,
      criticalThreshold: metricThreshold.critical,
      level: value >= metricThreshold.critical ? 'critical' : 'warning',
    });
  };

  pushCause('cpu', server.cpu_usage ?? server.cpu ?? 0);
  pushCause('memory', server.memory_usage ?? server.memory ?? 0);
  pushCause('disk', server.disk_usage ?? server.disk ?? 0);
  pushCause('network', server.network ?? 0);

  return causes;
}

function buildSummary(
  server: EnhancedServerMetrics,
  status: IncidentSeverity,
  causes: IncidentCause[]
): string {
  if (status === 'offline') return `${server.id} offline`;
  if (causes.length === 0) return `${server.id} ${status}`;

  const causeText = causes
    .map((cause) => `${cause.metric.toUpperCase()} ${cause.value}%`)
    .join(', ');
  return `${server.id} ${status} (${causeText})`;
}

function computeScore(
  status: IncidentSeverity,
  causes: IncidentCause[]
): number {
  const statusWeight =
    status === 'offline' ? 300 : status === 'critical' ? 200 : 100;
  const causeWeight = causes.reduce(
    (acc, cause) => acc + (cause.level === 'critical' ? 20 : 10),
    0
  );
  return statusWeight + causeWeight;
}

async function buildIncidentIndex(): Promise<IncidentIndex> {
  const now = Date.now();
  if (
    INCIDENT_INDEX_CACHE &&
    now - INCIDENT_INDEX_CACHE.builtAt < INDEX_CACHE_TTL_MS
  ) {
    return INCIDENT_INDEX_CACHE;
  }

  const catalog = await getOTelResourceCatalog();
  if (!catalog) {
    const emptyIndex: IncidentIndex = {
      builtAt: now,
      windowStart: null,
      windowEnd: null,
      events: [],
    };
    INCIDENT_INDEX_CACHE = emptyIndex;
    return emptyIndex;
  }

  const events: IncidentEvent[] = [];
  let minTs: number | null = null;
  let maxTs: number | null = null;

  for (let hour = 0; hour < 24; hour++) {
    const hourly = await getOTelHourlyData(hour);
    if (!hourly) continue;

    for (let slotIndex = 0; slotIndex < hourly.slots.length; slotIndex++) {
      const slot = hourly.slots[slotIndex];
      if (!slot) continue;

      const slotUnixMs = Math.floor(Number(slot.startTimeUnixNano) / 1_000_000);
      if (Number.isFinite(slotUnixMs)) {
        minTs = minTs === null ? slotUnixMs : Math.min(minTs, slotUnixMs);
        maxTs = maxTs === null ? slotUnixMs : Math.max(maxTs, slotUnixMs);
      }

      const timestamp = new Date(slotUnixMs).toISOString();
      const servers = otelSlotToServers(slot, catalog, timestamp);

      for (const server of servers) {
        if (
          server.status !== 'warning' &&
          server.status !== 'critical' &&
          server.status !== 'offline'
        ) {
          continue;
        }

        const causes = buildCauses(server);
        const status = server.status as IncidentSeverity;
        const serverId = getServerId(server);
        const eventId = `${hour}-${slotIndex}-${serverId}-${status}`;

        events.push({
          id: eventId,
          timestamp,
          timestampUnixMs: slotUnixMs,
          hour,
          slotIndex,
          serverId,
          hostname: server.hostname,
          serverType: server.type,
          environment: server.environment,
          status,
          metrics: {
            cpu: server.cpu_usage ?? server.cpu ?? 0,
            memory: server.memory_usage ?? server.memory ?? 0,
            disk: server.disk_usage ?? server.disk ?? 0,
            network: server.network ?? 0,
          },
          causes,
          score: computeScore(status, causes),
          summary: buildSummary(server, status, causes),
        });
      }
    }
  }

  const index: IncidentIndex = {
    builtAt: now,
    windowStart: minTs,
    windowEnd: maxTs,
    events,
  };
  INCIDENT_INDEX_CACHE = index;
  return index;
}

function parseTimeFilter(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function bySortOrder(
  a: IncidentEvent,
  b: IncidentEvent,
  sortOrder: SortOrder
): number {
  const result =
    b.score - a.score ||
    b.timestampUnixMs - a.timestampUnixMs ||
    a.serverId.localeCompare(b.serverId);
  return sortOrder === 'asc' ? -result : result;
}

export async function queryIncidentEvents(query: IncidentQuery): Promise<{
  items: IncidentEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metadata: {
    builtAt: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    cacheAgeMs: number | null;
  };
}> {
  const index = await buildIncidentIndex();
  const search = query.search?.trim().toLowerCase();
  const fromMs = parseTimeFilter(query.from);
  const toMs = parseTimeFilter(query.to);
  const severity = query.severity;
  const metric = query.metric;
  const sortOrder = query.sortOrder ?? 'desc';
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  let filtered = index.events;

  if (severity) {
    filtered = filtered.filter((event) => event.status === severity);
  }

  if (metric) {
    filtered = filtered.filter((event) => {
      if (metric === 'composite')
        return event.causes.length >= 2 || event.status === 'offline';
      return event.causes.some((cause) => cause.metric === metric);
    });
  }

  if (fromMs !== null) {
    filtered = filtered.filter((event) => event.timestampUnixMs >= fromMs);
  }

  if (toMs !== null) {
    filtered = filtered.filter((event) => event.timestampUnixMs <= toMs);
  }

  if (search) {
    filtered = filtered.filter((event) => {
      const causeMetrics = event.causes.map((cause) => cause.metric).join(' ');
      return (
        event.serverId.toLowerCase().includes(search) ||
        event.hostname.toLowerCase().includes(search) ||
        event.serverType.toLowerCase().includes(search) ||
        event.status.toLowerCase().includes(search) ||
        event.summary.toLowerCase().includes(search) ||
        causeMetrics.includes(search)
      );
    });
  }

  const sorted = [...filtered].sort((a, b) => bySortOrder(a, b, sortOrder));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * limit;
  const endIndex = startIndex + limit;

  return {
    items: sorted.slice(startIndex, endIndex),
    total,
    page: currentPage,
    limit,
    totalPages,
    metadata: {
      builtAt: index.builtAt ? new Date(index.builtAt).toISOString() : null,
      windowStart: index.windowStart
        ? new Date(index.windowStart).toISOString()
        : null,
      windowEnd: index.windowEnd
        ? new Date(index.windowEnd).toISOString()
        : null,
      cacheAgeMs: index.builtAt ? Date.now() - index.builtAt : null,
    },
  };
}

export function resetIncidentIndexCacheForTesting(): void {
  if (process.env.NODE_ENV !== 'test') return;
  INCIDENT_INDEX_CACHE = null;
}
