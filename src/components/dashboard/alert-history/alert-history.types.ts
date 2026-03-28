import type { Alert } from '@/services/monitoring/AlertManager';

export type AlertHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  serverIds: string[];
  onAskAIAboutAlert?: (alert: Alert) => void;
};

export const TIME_RANGE_OPTIONS = [
  { label: '1h', value: 3_600_000 },
  { label: '6h', value: 21_600_000 },
  { label: '24h', value: 86_400_000 },
  { label: '전체', value: 0 },
] as const;
