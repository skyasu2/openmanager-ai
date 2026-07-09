import { LayoutGrid, Network } from 'lucide-react';
import type { Server } from '@/types/server';

const STATUS_PRIORITY = {
  critical: 0,
  offline: 0,
  warning: 1,
  online: 2,
} as const;

export type ServerViewMode = 'list' | 'grid';
export type ServerSortKey = 'status' | 'cpu' | 'memory' | 'name';
export type ServerVisualizationMode = 'cards' | 'host-map';

export const DEFAULT_VISIBLE_ROWS = 3;

const SERVER_CARD_FIXED_WIDTH = {
  grid: 320,
  list: 290,
} as const;

export const SORT_OPTIONS: Array<{ value: ServerSortKey; label: string }> = [
  { value: 'status', label: '상태' },
  { value: 'cpu', label: 'CPU' },
  { value: 'memory', label: 'MEM' },
  { value: 'name', label: '이름' },
];

export const VISUALIZATION_OPTIONS: Array<{
  value: ServerVisualizationMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { value: 'cards', label: '서버 카드', icon: LayoutGrid },
  { value: 'host-map', label: '호스트 맵', icon: Network },
];

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

function getAlertsCountOptimized(alerts: unknown): number {
  if (typeof alerts === 'number') return alerts;
  if (Array.isArray(alerts)) return alerts.length;
  return 0;
}

export function compareByStatusPriority(a: Server, b: Server): number {
  const statusA = a?.status || 'unknown';
  const statusB = b?.status || 'unknown';

  const priorityA =
    STATUS_PRIORITY[statusA as keyof typeof STATUS_PRIORITY] ?? 3;
  const priorityB =
    STATUS_PRIORITY[statusB as keyof typeof STATUS_PRIORITY] ?? 3;

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  const alertsA = getAlertsCountOptimized(a?.alerts);
  const alertsB = getAlertsCountOptimized(b?.alerts);

  if (alertsA !== alertsB) {
    return alertsB - alertsA;
  }

  return a.name.localeCompare(b.name, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function normalizeServerSearchValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR');
}

export function matchesServerSearch(
  server: Server,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return true;

  return [server.name, server.id, server.hostname, server.location, server.ip]
    .map(normalizeServerSearchValue)
    .some((value) => value.includes(normalizedQuery));
}

export function getServerCardColumns(
  viewMode: ServerViewMode,
  width: number
): number {
  if (width < 640) return 1;

  const gap = getServerCardGapPx(viewMode, width);
  const cardWidth = SERVER_CARD_FIXED_WIDTH[viewMode];
  const columns = Math.floor((width + gap) / (cardWidth + gap));

  return Math.max(1, Math.min(4, columns));
}

function getServerCardGapPx(viewMode: ServerViewMode, width: number): number {
  if (viewMode === 'grid') {
    return width >= 640 ? 24 : 16;
  }

  return 12;
}

export function runDashboardViewTransition(callback: () => void): void {
  if (typeof document === 'undefined') {
    callback();
    return;
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const startViewTransition = (document as ViewTransitionDocument)
    .startViewTransition;

  if (prefersReducedMotion || typeof startViewTransition !== 'function') {
    callback();
    return;
  }

  startViewTransition.call(document, callback);
}
