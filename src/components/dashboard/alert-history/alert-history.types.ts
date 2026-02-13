import type {
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';

export type AlertHistoryFilterState = {
  severity: AlertSeverity | 'all';
  state: AlertState | 'all';
  serverId: string; // '' = all
  timeRangeMs: number; // ms, 0 = all
};

export type AlertHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  serverIds: string[];
};

export const TIME_RANGE_OPTIONS = [
  { label: '1h', value: 3_600_000 },
  { label: '6h', value: 21_600_000 },
  { label: '24h', value: 86_400_000 },
  { label: '전체', value: 0 },
] as const;
