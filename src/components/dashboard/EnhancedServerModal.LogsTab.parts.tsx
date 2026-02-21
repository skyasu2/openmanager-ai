import type { FC } from 'react';
import type { LokiLogEntry, LokiStream, LokiStreamLabels } from '@/types/loki';
import type { LogEntry, LogLevel } from './EnhancedServerModal.types';

type ServerContext = {
  hostname: string;
  environment: string;
  datacenter: string;
  serverType: string;
};

export const getLogLevelStyles = (level: LogLevel | string) => {
  switch (level) {
    case 'error':
      return {
        containerClass: 'bg-red-500/10 border-l-4 border-red-500',
        badgeClass: 'bg-red-500 text-white',
        textClass: 'text-red-300',
      };
    case 'warn':
      return {
        containerClass: 'bg-yellow-500/10 border-l-4 border-yellow-500',
        badgeClass: 'bg-yellow-500 text-white',
        textClass: 'text-yellow-300',
      };
    default:
      return {
        containerClass: 'bg-green-500/10 border-l-4 border-green-500',
        badgeClass: 'bg-green-500 text-white',
        textClass: 'text-green-300',
      };
  }
};

export const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? new Date().toLocaleTimeString()
      : date.toLocaleTimeString();
  } catch {
    return new Date().toLocaleTimeString();
  }
};

export const formatNsTimestamp = (ns: string): string => {
  const ms = Number(ns) / 1_000_000;
  try {
    const date = new Date(ms);
    return Number.isNaN(date.getTime())
      ? new Date().toLocaleTimeString()
      : date.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
        });
  } catch {
    return new Date().toLocaleTimeString();
  }
};

export function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

export function LegacyLogView({
  activeView,
  displayLogs,
}: {
  activeView: 'syslog' | 'alerts';
  displayLogs: LogEntry[];
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-800 to-black" />
      <div className="relative h-[500px] overflow-y-auto p-6 font-mono text-sm">
        {displayLogs.length > 0 ? (
          displayLogs.map((log: LogEntry, idx: number) => {
            const styles = getLogLevelStyles(log.level);
            return (
              <div
                key={idx}
                className={`animate-fade-in mb-3 flex items-start gap-3 rounded-lg p-3 backdrop-blur-sm ${styles.containerClass}`}
                style={{ animationDelay: `${idx * 0.02}s` }}
              >
                <div className="shrink-0">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs font-bold ${styles.badgeClass}`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className="text-xs font-semibold text-blue-400">
                      [{log.source || 'system'}]
                    </span>
                  </div>
                  <div className={styles.textClass}>{log.message}</div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            icon={activeView === 'syslog' ? 'log' : 'check'}
            title={
              activeView === 'syslog' ? 'No logs available' : 'No system alerts'
            }
            description={
              activeView === 'syslog'
                ? 'No OTel structured logs found for this server in the current time slot'
                : 'All system metrics are within normal range'
            }
          />
        )}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-gray-900 to-transparent" />
    </div>
  );
}

export const StreamsView: FC<{
  logqlQuery: string;
  availableLabels: { jobs: string[]; levels: string[] };
  labelFilters: Partial<LokiStreamLabels>;
  toggleFilter: (key: keyof LokiStreamLabels, value: string) => void;
  streams: LokiStream[];
  expandedStreams: Set<string>;
  toggleStream: (key: string) => void;
  ctx: ServerContext;
}> = ({
  logqlQuery,
  availableLabels,
  labelFilters,
  toggleFilter,
  streams,
  expandedStreams,
  toggleStream,
  ctx,
}) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 text-xs font-medium text-gray-500">LogQL</div>
        <code className="block break-all font-mono text-sm text-gray-800">
          {logqlQuery}
        </code>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium text-gray-500">
          job:
        </span>
        {availableLabels.jobs.map((job) => (
          <FilterChip
            key={`job-${job}`}
            label={job}
            active={labelFilters.job === job}
            onClick={() => toggleFilter('job', job)}
          />
        ))}
        <span className="ml-2 self-center text-xs font-medium text-gray-500">
          level:
        </span>
        {availableLabels.levels.map((level) => (
          <FilterChip
            key={`level-${level}`}
            label={level}
            active={labelFilters.level === level}
            onClick={() =>
              toggleFilter('level', level as LokiStreamLabels['level'])
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">
          {ctx.hostname}
        </span>
        <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-700">
          {ctx.environment}
        </span>
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">
          {ctx.datacenter}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl shadow-2xl">
        <div className="absolute inset-0 bg-linear-to-br from-gray-900 via-gray-800 to-black" />
        <div className="relative h-[500px] overflow-y-auto p-4 font-mono text-sm">
          {streams.length > 0 ? (
            streams.map((stream, si) => {
              const streamKey = `${stream.stream.job}|${stream.stream.level}`;
              const isExpanded = expandedStreams.has(streamKey);
              const levelStyles = getLogLevelStyles(stream.stream.level);

              return (
                <div key={si} className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleStream(streamKey)}
                    className="mb-2 flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="text-gray-400">
                      {isExpanded ? '\u25BC' : '\u25B6'}
                    </span>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${levelStyles.badgeClass}`}
                    >
                      {stream.stream.level.toUpperCase()}
                    </span>
                    <span className="text-xs text-blue-400">
                      job={stream.stream.job}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({stream.values.length} entries)
                    </span>
                  </button>

                  {isExpanded &&
                    stream.values.map(([ns, line], li) => (
                      <div
                        key={li}
                        className={`mb-1 flex items-start gap-3 rounded px-3 py-2 ${levelStyles.containerClass}`}
                      >
                        <span className="shrink-0 text-xs tabular-nums text-gray-500">
                          {formatNsTimestamp(ns)}
                        </span>
                        <span className={`flex-1 ${levelStyles.textClass}`}>
                          {line}
                        </span>
                      </div>
                    ))}
                </div>
              );
            })
          ) : (
            <EmptyState
              icon="log"
              title="No matching streams"
              description="Adjust label filters to see log streams"
            />
          )}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-gray-900 to-transparent" />
      </div>
    </div>
  );
};

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-blue-500 bg-blue-500 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: 'log' | 'check';
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-4 text-6xl opacity-50">
          {icon === 'check' ? '\u2705' : '\uD83D\uDCCB'}
        </div>
        <div className="mb-2 text-lg font-medium text-gray-400">{title}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
    </div>
  );
}

export function LogStats({
  activeView,
  logs,
}: {
  activeView: string;
  logs: LogEntry[];
}) {
  const infoCount = logs.filter((l) => l.level === 'info').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;
  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <div
      className="animate-fade-in mt-6 grid grid-cols-1 gap-4 md:grid-cols-4"
      style={{ animationDelay: '0.3s' }}
    >
      <StatCard
        label={activeView === 'syslog' ? 'Total Logs' : 'Total Alerts'}
        value={logs.length}
        color="text-gray-800"
        bgColor="bg-gray-100"
      />
      <StatCard
        label="INFO"
        value={infoCount}
        color="text-green-600"
        bgColor="bg-green-100"
      />
      <StatCard
        label="WARN"
        value={warnCount}
        color="text-yellow-600"
        bgColor="bg-yellow-100"
      />
      <StatCard
        label="ERROR"
        value={errorCount}
        color="text-red-600"
        bgColor="bg-red-100"
      />
    </div>
  );
}

export function StreamStats({
  logs,
  streams,
}: {
  logs: LokiLogEntry[];
  streams: LokiStream[];
}) {
  const infoCount = logs.filter((l) => l.labels.level === 'info').length;
  const warnCount = logs.filter((l) => l.labels.level === 'warn').length;
  const errorCount = logs.filter((l) => l.labels.level === 'error').length;

  return (
    <div
      className="animate-fade-in mt-6 grid grid-cols-1 gap-4 md:grid-cols-4"
      style={{ animationDelay: '0.3s' }}
    >
      <StatCard
        label="Streams"
        value={streams.length}
        color="text-gray-800"
        bgColor="bg-gray-100"
      />
      <StatCard
        label="INFO"
        value={infoCount}
        color="text-green-600"
        bgColor="bg-green-100"
      />
      <StatCard
        label="WARN"
        value={warnCount}
        color="text-yellow-600"
        bgColor="bg-yellow-100"
      />
      <StatCard
        label="ERROR"
        value={errorCount}
        color="text-red-600"
        bgColor="bg-red-100"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bgColor,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-600">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
        <div className={`rounded-lg p-2 ${bgColor}`}>
          <span className="text-lg font-bold text-gray-500">#</span>
        </div>
      </div>
    </div>
  );
}
