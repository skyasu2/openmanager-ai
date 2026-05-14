import type {
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import { TIME_RANGE_OPTIONS } from './alert-history.types';

export const severityColors: Record<
  AlertSeverity,
  { badge: string; border: string }
> = {
  critical: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    border: 'border-l-red-500',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    border: 'border-l-amber-500',
  },
};

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
}

export const INITIAL_DISPLAY = 50;
export const LOAD_MORE_COUNT = 50;
const DEFAULT_TIME_RANGE_MS = 86_400_000;
const ALERT_FILTER_QUERY_KEYS = [
  'severity',
  'state',
  'server',
  'serverId',
  'range',
  'q',
] as const;

export type AlertFilterQueryState = {
  severity: AlertSeverity | 'all';
  state: AlertState | 'all';
  serverId: string;
  timeRangeMs: number;
  keyword: string;
};

export const normalizeInitialServerId = (
  initialServerId: string | null | undefined,
  serverIds: string[]
) =>
  initialServerId && serverIds.includes(initialServerId) ? initialServerId : '';

function parseAlertSeverity(value: string | null): AlertSeverity | 'all' {
  return value === 'critical' || value === 'warning' ? value : 'all';
}

function parseAlertState(value: string | null): AlertState | 'all' {
  return value === 'firing' || value === 'resolved' ? value : 'all';
}

function parseAlertTimeRange(value: string | null): number {
  if (!value) return DEFAULT_TIME_RANGE_MS;
  if (value === '1h') return 3_600_000;
  if (value === '6h') return 21_600_000;
  if (value === '24h') return 86_400_000;
  if (value === 'all') return 0;

  const numericValue = Number(value);
  const supportedRange = TIME_RANGE_OPTIONS.find(
    (option) => option.value === numericValue
  );

  return supportedRange?.value ?? DEFAULT_TIME_RANGE_MS;
}

function formatAlertTimeRange(value: number): string | null {
  if (value === 3_600_000) return '1h';
  if (value === 21_600_000) return '6h';
  if (value === 0) return 'all';
  return null;
}

export function parseAlertFilterQuery(
  searchParams: URLSearchParams,
  serverIds: string[],
  initialServerId: string
): AlertFilterQueryState {
  return {
    severity: parseAlertSeverity(searchParams.get('severity')),
    state: parseAlertState(searchParams.get('state')),
    serverId: normalizeInitialServerId(
      searchParams.get('server') ??
        searchParams.get('serverId') ??
        initialServerId,
      serverIds
    ),
    timeRangeMs: parseAlertTimeRange(searchParams.get('range')),
    keyword: searchParams.get('q')?.trim() ?? '',
  };
}

export function buildAlertFilterQuery(
  currentQueryString: string,
  filters: AlertFilterQueryState
) {
  const next = new URLSearchParams(currentQueryString);
  ALERT_FILTER_QUERY_KEYS.forEach((key) => {
    next.delete(key);
  });

  if (filters.severity !== 'all') next.set('severity', filters.severity);
  if (filters.state !== 'all') next.set('state', filters.state);
  if (filters.serverId) next.set('server', filters.serverId);

  const rangeParam = formatAlertTimeRange(filters.timeRangeMs);
  if (rangeParam) next.set('range', rangeParam);

  if (filters.keyword) next.set('q', filters.keyword);

  return next;
}

export function buildAlertFilterUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
