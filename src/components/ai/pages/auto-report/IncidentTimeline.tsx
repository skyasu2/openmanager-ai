/**
 * 장애 타임라인 시각화 컴포넌트
 *
 * 장애 진행 상황을 세로 타임라인으로 표시
 */

'use client';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Zap,
} from 'lucide-react';
import { memo } from 'react';

interface TimelineEvent {
  timestamp: string;
  event: string;
  severity: string;
  type?: 'detection' | 'escalation' | 'action' | 'resolution' | 'info';
}

interface IncidentTimelineProps {
  events: TimelineEvent[];
  compact?: boolean;
}

const DEFAULT_COLOR = {
  bg: 'bg-gray-50',
  border: 'border-gray-300',
  text: 'text-gray-700',
  icon: 'text-gray-500',
};

const severityColors: Record<
  string,
  { bg: string; border: string; text: string; icon: string }
> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    icon: 'text-red-500',
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-700',
    icon: 'text-orange-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: 'text-amber-500',
  },
  medium: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    icon: 'text-yellow-500',
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    icon: 'text-blue-500',
  },
  info: {
    bg: 'bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-700',
    icon: 'text-gray-500',
  },
  resolved: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-700',
    icon: 'text-green-500',
  },
};

function getEventIcon(event: TimelineEvent) {
  const type = event.type || inferEventType(event.event);
  const severity = event.severity.toLowerCase();
  const colorClass = severityColors[severity]?.icon || 'text-gray-500';

  switch (type) {
    case 'detection':
      return <AlertCircle className={`h-4 w-4 ${colorClass}`} />;
    case 'escalation':
      return <AlertTriangle className={`h-4 w-4 ${colorClass}`} />;
    case 'action':
      return <Zap className={`h-4 w-4 ${colorClass}`} />;
    case 'resolution':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      if (event.event.toLowerCase().includes('server')) {
        return <Server className={`h-4 w-4 ${colorClass}`} />;
      }
      if (
        event.event.toLowerCase().includes('metric') ||
        event.event.toLowerCase().includes('cpu') ||
        event.event.toLowerCase().includes('memory')
      ) {
        return <Activity className={`h-4 w-4 ${colorClass}`} />;
      }
      return <Clock className={`h-4 w-4 ${colorClass}`} />;
  }
}

function inferEventType(eventText: string): TimelineEvent['type'] {
  const text = eventText.toLowerCase();
  if (
    text.includes('감지') ||
    text.includes('detected') ||
    text.includes('발견')
  ) {
    return 'detection';
  }
  if (
    text.includes('escalat') ||
    text.includes('확산') ||
    text.includes('전파')
  ) {
    return 'escalation';
  }
  if (
    text.includes('조치') ||
    text.includes('action') ||
    text.includes('실행')
  ) {
    return 'action';
  }
  if (
    text.includes('해결') ||
    text.includes('resolved') ||
    text.includes('복구')
  ) {
    return 'resolution';
  }
  return 'info';
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return timestamp;
  }
}

function formatFullTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return timestamp;
  }
}

export const IncidentTimeline = memo(function IncidentTimeline({
  events,
  compact = false,
}: IncidentTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Clock className="mr-2 h-5 w-5" />
        <span>타임라인 이벤트가 없습니다</span>
      </div>
    );
  }

  // Sort events by timestamp (newest first for display, but we'll reverse for timeline)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {sortedEvents.slice(-5).map((event, index) => {
          const colors =
            severityColors[event.severity.toLowerCase()] ?? DEFAULT_COLOR;
          return (
            <div
              key={`${event.timestamp}-${index}`}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${colors.bg} ${colors.border}`}
            >
              {getEventIcon(event)}
              <span className={`flex-1 text-sm ${colors.text}`}>
                {event.event}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          );
        })}
        {events.length > 5 && (
          <div className="text-center text-xs text-gray-500">
            +{events.length - 5}개 더 보기
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {sortedEvents.map((event, index) => {
          const colors =
            severityColors[event.severity.toLowerCase()] ?? DEFAULT_COLOR;
          const isFirst = index === 0;
          const isLast = index === sortedEvents.length - 1;

          return (
            <div
              key={`${event.timestamp}-${index}`}
              className="relative flex items-start gap-4 pl-10"
            >
              {/* Timeline dot */}
              <div
                className={`absolute left-2 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white ${colors.border}`}
              >
                {getEventIcon(event)}
              </div>

              {/* Event card */}
              <div
                className={`flex-1 rounded-lg border p-3 transition-all hover:shadow-md ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${colors.text}`}>
                      {event.event}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatFullTimestamp(event.timestamp)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
                  >
                    {event.severity}
                  </span>
                </div>

                {/* Connection indicator */}
                {isFirst && (
                  <div className="mt-2 text-xs text-gray-400">시작</div>
                )}
                {isLast && sortedEvents.length > 1 && (
                  <div className="mt-2 text-xs text-gray-400">최신</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2 text-sm">
        <span className="text-gray-600">총 {events.length}개 이벤트</span>
        {(() => {
          const firstEvent = sortedEvents[0];
          const lastEvent = sortedEvents[sortedEvents.length - 1];
          if (!firstEvent || !lastEvent) return null;
          return (
            <span className="text-gray-500">
              {formatFullTimestamp(firstEvent.timestamp)} ~{' '}
              {formatFullTimestamp(lastEvent.timestamp)}
            </span>
          );
        })()}
      </div>
    </div>
  );
});

export default IncidentTimeline;
