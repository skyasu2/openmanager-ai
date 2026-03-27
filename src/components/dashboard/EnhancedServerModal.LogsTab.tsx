'use client';

/**
 * Enhanced Server Modal Logs Tab (v5.0 - OTel SSOT)
 *
 * Three view modes:
 * - Syslog: OTel structured logs → SyslogEntry view
 * - Alerts: metric threshold-based system alerts (realtimeData.logs)
 * - Streams: OTel logs → Loki-compatible stream view with label filters and LogQL
 *
 * Data flow (OTel SSOT):
 *   OTel hourly slot.logs → server.structuredLogs → otelToSyslogView / otelToLokiEntry
 *
 * Fallback: when structuredLogs is empty, falls back to serverLogs (Prometheus pipeline)
 * or generateServerLogs/generateLokiLogs (synthetic).
 */

import type { FC } from 'react';
import { useMemo, useState } from 'react';
import {
  buildLogQL,
  groupOTelLogsIntoStreams,
  otelToLokiEntry,
  otelToSyslogView,
} from '@/services/log-pipeline/otel-log-views';
import type { LokiLogEntry, LokiStream, LokiStreamLabels } from '@/types/loki';
import type { OTelLogRecord } from '@/types/otel-metrics';
import type { LogEntry as ServerLogEntry } from '@/types/server';
import {
  LegacyLogView,
  LegendDot,
  LogStats,
  StreamStats,
  StreamsView,
  ViewButton,
} from './EnhancedServerModal.LogsTab.parts';
import type {
  LogEntry,
  LogLevel,
  RealtimeData,
} from './EnhancedServerModal.types';

type ViewMode = 'syslog' | 'alerts' | 'streams';

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
  /** Legacy hourly-data logs (Prometheus pipeline, uppercase level) */
  serverLogs?: ServerLogEntry[];
  /** OTel structured logs (SSOT - preferred source) */
  structuredLogs?: OTelLogRecord[];
}

export const LogsTab: FC<LogsTabProps> = ({
  serverId,
  serverMetrics: _serverMetrics,
  realtimeData,
  serverContext,
  serverLogs,
  structuredLogs,
}) => {
  const [activeView, setActiveView] = useState<ViewMode>('syslog');
  const [labelFilters, setLabelFilters] = useState<Partial<LokiStreamLabels>>(
    {}
  );
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(
    new Set()
  );

  const ctx = serverContext ?? {
    hostname: serverId.split('.')[0] || serverId,
    environment: 'production',
    datacenter: 'DC1-AZ1',
    serverType: 'web',
  };

  // ── OTel SSOT → Syslog view (primary) ──────────────────────────
  const syslogView = useMemo((): LogEntry[] => {
    // Primary: OTel structured logs
    if (structuredLogs && structuredLogs.length > 0) {
      return structuredLogs.map((log) => {
        const entry = otelToSyslogView(log);
        return {
          timestamp: entry.timestamp,
          level: entry.level as LogLevel,
          message: entry.message,
          source: entry.source,
        };
      });
    }

    // Fallback: Legacy serverLogs (Prometheus pipeline, uppercase level)
    if (serverLogs && serverLogs.length > 0) {
      return serverLogs.map((log) => ({
        timestamp: log.timestamp,
        level: log.level.toLowerCase() as LogLevel,
        message: log.message,
        source: 'syslog',
      }));
    }

    return [];
  }, [structuredLogs, serverLogs]);

  // ── OTel SSOT → Loki view (primary) ────────────────────────────
  const lokiLogs = useMemo((): LokiLogEntry[] => {
    if (structuredLogs && structuredLogs.length > 0) {
      return structuredLogs.map(otelToLokiEntry);
    }
    return [];
  }, [structuredLogs]);

  // Filtered Loki entries
  const filteredLokiLogs = useMemo(() => {
    if (Object.keys(labelFilters).length === 0) return lokiLogs;
    return lokiLogs.filter((entry) =>
      Object.entries(labelFilters).every(
        ([k, v]) => !v || entry.labels[k as keyof LokiStreamLabels] === v
      )
    );
  }, [lokiLogs, labelFilters]);

  // ── OTel SSOT → Streams (primary) ──────────────────────────────
  const streams = useMemo((): LokiStream[] => {
    if (structuredLogs && structuredLogs.length > 0) {
      // Filter by label filters: convert OTel logs → Loki entries, then group
      if (Object.keys(labelFilters).length > 0) {
        // Use pre-filtered lokiLogs
        const streamMap = new Map<string, LokiStream>();
        for (const entry of filteredLokiLogs) {
          const key = `${entry.labels.job}|${entry.labels.level}`;
          let stream = streamMap.get(key);
          if (!stream) {
            stream = { stream: { ...entry.labels }, values: [] };
            streamMap.set(key, stream);
          }
          stream.values.push([entry.timestampNs, entry.line]);
        }
        return Array.from(streamMap.values());
      }
      // No filters: use OTel grouping directly
      return groupOTelLogsIntoStreams(structuredLogs);
    }
    return [];
  }, [structuredLogs, labelFilters, filteredLokiLogs]);

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
  const displayLogs = activeView === 'syslog' ? syslogView : realtimeData.logs;

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
                active={activeView === 'syslog'}
                onClick={() => setActiveView('syslog')}
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
