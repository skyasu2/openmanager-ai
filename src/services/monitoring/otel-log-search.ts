import { getOTelHourlyData } from '@/data/otel-data';
import {
  type SyslogEntry,
  otelToSyslogView,
} from '@/services/log-pipeline/otel-log-views';

export type LogQuery = {
  level?: 'info' | 'warn' | 'error';
  source?: string;
  serverId?: string;
  keyword?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
};

export type LogQueryResult = {
  items: Array<SyslogEntry & { serverId: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metadata: {
    builtAt: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    cacheAgeMs: number | null;
    availableSources: string[];
    availableServers: string[];
  };
};

type LogIndex = {
  builtAt: number;
  windowStart: number | null;
  windowEnd: number | null;
  entries: Array<SyslogEntry & { serverId: string; timestampMs: number }>;
  sources: string[];
  servers: string[];
};

let LOG_INDEX_CACHE: LogIndex | null = null;
const INDEX_CACHE_TTL_MS = 60_000;

async function buildLogIndex(): Promise<LogIndex> {
  const now = Date.now();
  if (LOG_INDEX_CACHE && now - LOG_INDEX_CACHE.builtAt < INDEX_CACHE_TTL_MS) {
    return LOG_INDEX_CACHE;
  }

  const entries: LogIndex['entries'] = [];
  let minTs: number | null = null;
  let maxTs: number | null = null;
  const sourceSet = new Set<string>();
  const serverSet = new Set<string>();

  for (let hour = 0; hour < 24; hour++) {
    const hourly = await getOTelHourlyData(hour);
    if (!hourly) continue;

    for (const slot of hourly.slots) {
      if (!slot?.logs) continue;

      const slotUnixMs = Math.floor(Number(slot.startTimeUnixNano) / 1_000_000);
      if (Number.isFinite(slotUnixMs)) {
        minTs = minTs === null ? slotUnixMs : Math.min(minTs, slotUnixMs);
        maxTs = maxTs === null ? slotUnixMs : Math.max(maxTs, slotUnixMs);
      }

      for (const log of slot.logs) {
        const view = otelToSyslogView(log);
        const serverId = log.resource;
        const timestampMs = Math.floor(log.timeUnixNano / 1_000_000);

        sourceSet.add(view.source);
        serverSet.add(serverId);

        entries.push({ ...view, serverId, timestampMs });
      }
    }
  }

  const index: LogIndex = {
    builtAt: now,
    windowStart: minTs,
    windowEnd: maxTs,
    entries,
    sources: Array.from(sourceSet).sort(),
    servers: Array.from(serverSet).sort(),
  };
  LOG_INDEX_CACHE = index;
  return index;
}

export async function queryOTelLogs(query: LogQuery): Promise<LogQueryResult> {
  const index = await buildLogIndex();
  const sortOrder = query.sortOrder ?? 'desc';
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));

  let filtered = index.entries;

  if (query.level) {
    filtered = filtered.filter((e) => e.level === query.level);
  }
  if (query.source) {
    filtered = filtered.filter((e) => e.source === query.source);
  }
  if (query.serverId) {
    filtered = filtered.filter((e) => e.serverId === query.serverId);
  }
  if (query.keyword) {
    const kw = query.keyword.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.message.toLowerCase().includes(kw) ||
        e.serverId.toLowerCase().includes(kw) ||
        e.source.toLowerCase().includes(kw)
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    const diff = a.timestampMs - b.timestampMs;
    return sortOrder === 'asc' ? diff : -diff;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * limit;

  return {
    items: sorted
      .slice(startIndex, startIndex + limit)
      .map(({ timestampMs: _ts, ...rest }) => rest),
    total,
    page: currentPage,
    limit,
    totalPages,
    metadata: {
      builtAt: new Date(index.builtAt).toISOString(),
      windowStart: index.windowStart
        ? new Date(index.windowStart).toISOString()
        : null,
      windowEnd: index.windowEnd
        ? new Date(index.windowEnd).toISOString()
        : null,
      cacheAgeMs: Date.now() - index.builtAt,
      availableSources: index.sources,
      availableServers: index.servers,
    },
  };
}

export function resetLogIndexCacheForTesting(): void {
  if (process.env.NODE_ENV !== 'test') return;
  LOG_INDEX_CACHE = null;
}
