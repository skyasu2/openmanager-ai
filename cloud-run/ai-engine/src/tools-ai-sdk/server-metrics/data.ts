/**
 * Server Metrics Data Helpers
 *
 * Cache key utilities, data source imports, and helper functions
 * for time range queries and aggregation.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import {
  getCurrentState,
  getStateBySlot,
  getSlots,
  type ServerSnapshot,
  type PrecomputedSlot,
} from '../../data/precomputed-state';
import { getDataCache } from '../../lib/cache-layer';
import {
  SERVER_TYPE_MAP,
  SERVER_TYPE_DESCRIPTIONS,
  SERVER_GROUP_INPUT_DESCRIPTION,
  SERVER_GROUP_DESCRIPTION_LIST,
  normalizeServerType,
} from '../../config/server-types';

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Create stable cache key from filter array
 * Ensures consistent key order in objects and sorted array items
 */
export function stableStringify(filters: Array<Record<string, unknown>> | undefined): string {
  if (!filters || filters.length === 0) return '[]';

  // Sort each object's keys and stringify, then sort array by resulting strings
  const normalized = filters.map(filter => {
    const sortedKeys = Object.keys(filter).sort();
    const sortedObj: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sortedObj[key] = filter[key];
    }
    return JSON.stringify(sortedObj);
  }).sort();

  return `[${normalized.join(',')}]`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current minute of day (KST)
 * Uses UTC+9 arithmetic instead of toLocaleString for consistency
 */
export function getCurrentMinuteOfDay(): number {
  const now = new Date();
  const kstHour = (now.getUTCHours() + 9) % 24;
  return kstHour * 60 + now.getUTCMinutes();
}

/**
 * Calculate aggregation over time series data
 */
export function calculateAggregation(
  dataPoints: Array<{ cpu: number; memory: number; disk: number }>,
  metric: 'cpu' | 'memory' | 'disk' | 'network' | 'all',
  func: 'avg' | 'max' | 'min' | 'count'
): Record<string, number> {
  if (func === 'count') {
    return { count: dataPoints.length };
  }

  const metrics = metric === 'all' ? ['cpu', 'memory', 'disk'] : [metric];
  const result: Record<string, number> = {};

  for (const m of metrics) {
    const values = dataPoints
      .map((d) => d[m as keyof typeof d] as number)
      .filter((v) => v !== undefined);

    if (values.length === 0) {
      result[m] = 0;
      continue;
    }

    switch (func) {
      case 'avg':
        result[m] =
          Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
          10;
        break;
      case 'max':
        result[m] = Math.max(...values);
        break;
      case 'min':
        result[m] = Math.min(...values);
        break;
    }
  }

  return result;
}

/**
 * Get time range data points for a server from precomputed slots
 */
export function getTimeRangeData(
  serverId: string,
  timeRange: string
): Array<{ cpu: number; memory: number; disk: number; network: number }> {
  const currentSlot = getCurrentSlotIndex();

  let slotsBack = 0;
  switch (timeRange) {
    case 'last1h':
      slotsBack = 6;
      break;
    case 'last6h':
      slotsBack = 36;
      break;
    case 'last24h':
      slotsBack = 144;
      break;
    case 'current':
    default: {
      const slot = getStateBySlot(currentSlot);
      const server = slot?.servers.find((s) => s.id === serverId);
      return server ? [{ cpu: server.cpu, memory: server.memory, disk: server.disk, network: server.network }] : [];
    }
  }

  const points: Array<{ cpu: number; memory: number; disk: number; network: number }> = [];
  for (let i = slotsBack - 1; i >= 0; i--) {
    const slotIdx = ((currentSlot - i) % 144 + 144) % 144;
    const slot = getStateBySlot(slotIdx);
    const server = slot?.servers.find((s) => s.id === serverId);
    if (server) {
      points.push({ cpu: server.cpu, memory: server.memory, disk: server.disk, network: server.network });
    }
  }
  return points;
}

function getCurrentSlotIndex(): number {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440;
  return Math.floor(kstMinutes / 10);
}

/**
 * Get 24h trend summaries for all servers from precomputed slots.
 * Replaces the old FIXED_24H_DATASETS-based get24hTrendSummaries().
 */
export function get24hTrendSummaries(): Array<{
  serverId: string;
  serverType: string;
  cpu: { avg: number; max: number; min: number };
  memory: { avg: number; max: number; min: number };
  disk: { avg: number; max: number; min: number };
}> {
  const slots = getSlots();
  if (slots.length === 0) return [];

  const serverMetrics = new Map<
    string,
    { type: string; cpu: number[]; memory: number[]; disk: number[] }
  >();

  for (const slot of slots) {
    for (const server of slot.servers) {
      if (!serverMetrics.has(server.id)) {
        serverMetrics.set(server.id, {
          type: server.type,
          cpu: [],
          memory: [],
          disk: [],
        });
      }
      const m = serverMetrics.get(server.id)!;
      m.cpu.push(server.cpu);
      m.memory.push(server.memory);
      m.disk.push(server.disk);
    }
  }

  const calcStats = (arr: number[]) => {
    if (arr.length === 0) return { avg: 0, max: 0, min: 0 };
    const sum = arr.reduce((a, b) => a + b, 0);
    return {
      avg: Math.round((sum / arr.length) * 10) / 10,
      max: Math.round(Math.max(...arr) * 10) / 10,
      min: Math.round(Math.min(...arr) * 10) / 10,
    };
  };

  const results: Array<{
    serverId: string;
    serverType: string;
    cpu: { avg: number; max: number; min: number };
    memory: { avg: number; max: number; min: number };
    disk: { avg: number; max: number; min: number };
  }> = [];

  for (const [serverId, metrics] of serverMetrics) {
    results.push({
      serverId,
      serverType: metrics.type,
      cpu: calcStats(metrics.cpu),
      memory: calcStats(metrics.memory),
      disk: calcStats(metrics.disk),
    });
  }

  return results;
}

/**
 * Get all server entries from precomputed slots (replaces FIXED_24H_DATASETS iteration).
 * Returns unique server info extracted from the latest available slot.
 */
export function getAllServerEntries(): Array<{
  serverId: string;
  serverType: string;
  location: string;
}> {
  const slots = getSlots();
  if (slots.length === 0) return [];

  // Use the latest slot to get server list
  const latestSlot = slots[slots.length - 1];
  return latestSlot.servers.map((s) => ({
    serverId: s.id,
    serverType: s.type,
    location: '',
  }));
}

// Re-export data sources for tools
export {
  getCurrentState,
  type ServerSnapshot,
  type PrecomputedSlot,
  getStateBySlot,
  getSlots,
  getDataCache,
  SERVER_TYPE_MAP,
  SERVER_TYPE_DESCRIPTIONS,
  SERVER_GROUP_INPUT_DESCRIPTION,
  SERVER_GROUP_DESCRIPTION_LIST,
  normalizeServerType,
};
