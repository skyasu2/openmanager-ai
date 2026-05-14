import { Bell } from 'lucide-react';
import type {
  GlobalLogEntry,
  GlobalLogFilter,
} from '@/hooks/dashboard/useGlobalLogs';

export const levelStyles: Record<
  Exclude<GlobalLogFilter['level'], undefined>,
  { badge: string; text: string; border: string }
> = {
  info: {
    badge: 'bg-green-500 text-white',
    text: 'text-green-700',
    border: 'border-l-green-500',
  },
  warn: {
    badge: 'bg-yellow-500 text-white',
    text: 'text-amber-700',
    border: 'border-l-yellow-500',
  },
  error: {
    badge: 'bg-red-500 text-white',
    text: 'text-red-700',
    border: 'border-l-red-500',
  },
};

export const INITIAL_DISPLAY = 50;
export const LOAD_MORE_COUNT = 50;

type LogGroup = {
  key: string;
  logs: GlobalLogEntry[];
  patternKey: string;
  representative: GlobalLogEntry;
};

const normalizeLogPattern = (message: string): string =>
  message
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, '<hex>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\b\d+(?:\.\d+)?(?:ms|s|%|mb|gb|kb|b)?\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim();

const getPatternKey = (log: GlobalLogEntry): string =>
  [log.serverId, log.level, log.source, normalizeLogPattern(log.message)].join(
    '|'
  );

const getLogKey = (log: GlobalLogEntry, index: number): string =>
  `${log.serverId}-${log.timestamp}-${log.level}-${log.source}-${index}`;

export const groupConsecutiveLogs = (logs: GlobalLogEntry[]): LogGroup[] => {
  const groups: LogGroup[] = [];

  logs.forEach((log, index) => {
    const patternKey = getPatternKey(log);
    const previousGroup = groups.at(-1);

    if (previousGroup?.patternKey === patternKey) {
      previousGroup.logs.push(log);
      return;
    }

    groups.push({
      key: getLogKey(log, index),
      logs: [log],
      patternKey,
      representative: log,
    });
  });

  return groups;
};

export function LogAlertButton({
  serverId,
  onOpenAlertHistory,
}: {
  serverId: string;
  onOpenAlertHistory: (serverId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpenAlertHistory(serverId);
      }}
      aria-label={`${serverId} 알림 이력 보기`}
      title="알림 이력"
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
    >
      <Bell size={11} />
      알림
    </button>
  );
}
