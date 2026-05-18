import type {
  AlertSeverity,
  AlertState,
} from '@/services/monitoring/AlertManager';
import { StatCell } from '../shared/StatCell';
import { formatDuration } from './AlertHistoryModal.helpers';

type AlertStats = {
  total: number;
  critical: number;
  warning: number;
  firing: number;
  avgResolutionSec: number;
};

type AlertHistoryStatsFooterProps = {
  stats: AlertStats;
  severity: AlertSeverity | 'all';
  state: AlertState | 'all';
  onShowAll: () => void;
  onToggleSeverity: (severity: AlertSeverity) => void;
  onToggleState: (state: AlertState) => void;
};

export function AlertHistoryStatsFooter({
  stats,
  severity,
  state,
  onShowAll,
  onToggleSeverity,
  onToggleState,
}: AlertHistoryStatsFooterProps) {
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:grid-cols-5 sm:gap-4 sm:px-6">
      <StatCell
        label="전체"
        value={stats.total}
        color="text-gray-800"
        active={severity === 'all' && state === 'all'}
        onClick={onShowAll}
      />
      <StatCell
        label="위험"
        value={stats.critical}
        color="text-red-600"
        active={severity === 'critical'}
        onClick={() => onToggleSeverity('critical')}
      />
      <StatCell
        label="경고"
        value={stats.warning}
        color="text-amber-600"
        active={severity === 'warning'}
        onClick={() => onToggleSeverity('warning')}
      />
      <StatCell
        label="발생중"
        value={stats.firing}
        color="text-red-500"
        active={state === 'firing'}
        onClick={() => onToggleState('firing')}
      />
      <StatCell
        label="평균 해결"
        value={
          stats.avgResolutionSec > 0
            ? formatDuration(stats.avgResolutionSec)
            : '-'
        }
        color="text-blue-600"
      />
    </div>
  );
}
