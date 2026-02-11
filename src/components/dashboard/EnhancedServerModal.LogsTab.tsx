'use client';

import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
/**
 * Enhanced Server Modal Logs Tab (v4.0 - PLG Stack Compatible)
 *
 * Three view modes:
 * - Scenario: syslog-style logs from scenario generator
 * - Alerts: metric threshold-based system alerts
 * - Streams: Loki-compatible stream view with label filters and LogQL
 */
import {
  buildLogQL,
  generateLokiLogs,
  getCurrentScenario,
  generateServerLogs,
  groupIntoStreams,
} from '@/services/server-data/server-data-loader';
import type { ServerContext } from '@/services/server-data/loki-log-generator';
import type { LokiLogEntry, LokiStreamLabels } from '@/types/loki';
import type {
  LogEntry,
  LogLevel,
  RealtimeData,
} from './EnhancedServerModal.types';

type ViewMode = 'scenario' | 'alerts' | 'streams';

interface LogsTabProps {
  serverId: string;
  serverMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  realtimeData: RealtimeData;
  serverContext?: {
    hostname: string;
    environment: string;
    datacenter: string;
    serverType: string;
  };
}

const getLogLevelStyles = (level: LogLevel | string) => {
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

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? new Date().toLocaleTimeString()
      : date.toLocaleTimeString();
  } catch {
    return new Date().toLocaleTimeString();
  }
};

/** Format nanosecond timestamp for display */
const formatNsTimestamp = (ns: string): string => {
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

export const LogsTab: FC<LogsTabProps> = ({
  serverId,
  serverMetrics,
  realtimeData,
  serverContext,
}) => {
  const [activeView, setActiveView] = useState<ViewMode>('scenario');
  const [currentScenario, setCurrentScenario] = useState<string>('');
  const [scenarioLogs, setScenarioLogs] = useState<LogEntry[]>([]);
  const [lokiLogs, setLokiLogs] = useState<LokiLogEntry[]>([]);
  const [labelFilters, setLabelFilters] = useState<Partial<LokiStreamLabels>>(
    {}
  );
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(
    new Set()
  );

  const ctx: ServerContext = serverContext ?? {
    hostname: serverId.split('.')[0] || serverId,
    environment: 'production',
    datacenter: 'Seoul-ICN-AZ1',
    serverType: 'web',
  };

  // Load scenario and generate logs
  useEffect(() => {
    const loadScenario = async () => {
      const scenario = await getCurrentScenario();
      if (scenario) {
        setCurrentScenario(scenario.scenario);
        const logs = generateServerLogs(
          scenario.scenario,
          serverMetrics,
          serverId
        );
        setScenarioLogs(logs);

        const loki = generateLokiLogs(
          scenario.scenario,
          serverMetrics,
          serverId,
          ctx
        );
        setLokiLogs(loki);
      }
    };

    loadScenario();
    const interval = setInterval(loadScenario, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, serverMetrics]);

  // Filtered Loki entries
  const filteredLokiLogs = useMemo(() => {
    if (Object.keys(labelFilters).length === 0) return lokiLogs;
    return lokiLogs.filter((entry) =>
      Object.entries(labelFilters).every(
        ([k, v]) => !v || entry.labels[k as keyof LokiStreamLabels] === v
      )
    );
  }, [lokiLogs, labelFilters]);

  // Grouped streams
  const streams = useMemo(
    () => groupIntoStreams(filteredLokiLogs),
    [filteredLokiLogs]
  );

  // LogQL string
  const logqlQuery = useMemo(() => buildLogQL(labelFilters), [labelFilters]);

  // Available label values for chips
  const availableLabels = useMemo(() => {
    const jobs = new Set<string>();
    const levels = new Set<string>();
    for (const entry of lokiLogs) {
      jobs.add(entry.labels.job);
      levels.add(entry.labels.level);
    }
    return {
      jobs: Array.from(jobs).sort(),
      levels: Array.from(levels).sort(),
    };
  }, [lokiLogs]);

  const toggleFilter = (key: keyof LokiStreamLabels, value: string) => {
    setLabelFilters((prev) => {
      const current = prev[key];
      if (current === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const toggleStream = (key: string) => {
    setExpandedStreams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Display logs for legacy views
  const displayLogs =
    activeView === 'scenario' ? scenarioLogs : realtimeData.logs;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="bg-linear-to-r from-gray-700 to-gray-900 bg-clip-text text-2xl font-bold text-transparent">
              Server Logs
            </h3>
            {/* View switcher */}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <ViewButton
                active={activeView === 'scenario'}
                onClick={() => setActiveView('scenario')}
                label="Syslog"
              />
              <ViewButton
                active={activeView === 'alerts'}
                onClick={() => setActiveView('alerts')}
                label="Alerts"
              />
              <ViewButton
                active={activeView === 'streams'}
                onClick={() => setActiveView('streams')}
                label="Streams"
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4">
            <LegendDot color="bg-green-500" label="INFO" />
            <LegendDot color="bg-yellow-500" label="WARN" />
            <LegendDot color="bg-red-500" label="ERROR" />
          </div>
        </div>

        {/* Streams view */}
        {activeView === 'streams' ? (
          <StreamsView
            logqlQuery={logqlQuery}
            availableLabels={availableLabels}
            labelFilters={labelFilters}
            toggleFilter={toggleFilter}
            streams={streams}
            expandedStreams={expandedStreams}
            toggleStream={toggleStream}
            currentScenario={currentScenario}
            ctx={ctx}
          />
        ) : (
          <>
            {activeView === 'alerts' && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                임계값 기반 알림 — 메트릭이 설정된 임계값을 초과할 때 자동
                생성됩니다
              </div>
            )}
            <LegacyLogView activeView={activeView} displayLogs={displayLogs} />
          </>
        )}

        {/* Stats summary */}
        {activeView !== 'streams' && displayLogs.length > 0 && (
          <LogStats activeView={activeView} logs={displayLogs} />
        )}
        {activeView === 'streams' && filteredLokiLogs.length > 0 && (
          <StreamStats logs={filteredLokiLogs} streams={streams} />
        )}
      </div>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────

function ViewButton({
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

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

function LegacyLogView({
  activeView,
  displayLogs,
}: {
  activeView: 'scenario' | 'alerts';
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
            icon={activeView === 'scenario' ? 'log' : 'check'}
            title={
              activeView === 'scenario' ? 'Loading logs...' : 'No system alerts'
            }
            description={
              activeView === 'scenario'
                ? 'Fetching logs matching current server state'
                : 'All system metrics are within normal range'
            }
          />
        )}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-linear-to-t from-gray-900 to-transparent" />
    </div>
  );
}

function StreamsView({
  logqlQuery,
  availableLabels,
  labelFilters,
  toggleFilter,
  streams,
  expandedStreams,
  toggleStream,
  currentScenario,
  ctx,
}: {
  logqlQuery: string;
  availableLabels: { jobs: string[]; levels: string[] };
  labelFilters: Partial<LokiStreamLabels>;
  toggleFilter: (key: keyof LokiStreamLabels, value: string) => void;
  streams: ReturnType<typeof groupIntoStreams>;
  expandedStreams: Set<string>;
  toggleStream: (key: string) => void;
  currentScenario: string;
  ctx: ServerContext;
}) {
  return (
    <div className="space-y-4">
      {/* LogQL query bar */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="mb-1 text-xs font-medium text-gray-500">LogQL</div>
        <code className="block break-all font-mono text-sm text-gray-800">
          {logqlQuery}
        </code>
      </div>

      {/* Label filter chips */}
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

      {/* Scenario + context badges */}
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
        {currentScenario && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">
            scenario: {currentScenario}
          </span>
        )}
      </div>

      {/* Stream groups */}
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
                  {/* Stream header */}
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

                  {/* Stream entries */}
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
}

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

function LogStats({
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
        label={activeView === 'scenario' ? 'Total Logs' : 'Total Alerts'}
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

function StreamStats({
  logs,
  streams,
}: {
  logs: LokiLogEntry[];
  streams: ReturnType<typeof groupIntoStreams>;
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
