'use client';

import { Activity, ChevronDown, ChevronRight, Play, Zap } from 'lucide-react';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const TTL_OPTIONS = [
  { label: '5min', value: 300 },
  { label: '15min', value: 900 },
  { label: '30min', value: 1800 },
  { label: '1hr', value: 3600 },
];

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: 'bg-gray-100 text-gray-700 border-gray-300',
  info: 'bg-blue-100 text-blue-700 border-blue-300',
  warn: 'bg-amber-100 text-amber-700 border-amber-300',
  error: 'bg-red-100 text-red-700 border-red-300',
};

type LogLevelStatus = {
  vercel: { level: string; defaultLevel: string };
  cloudRun: { level: string; reachable: boolean };
};

export function AIDebugPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [latency, setLatency] = useState<number | null>(null);

  // Log level state
  const [logExpanded, setLogExpanded] = useState(false);
  const [logStatus, setLogStatus] = useState<LogLevelStatus | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<LogLevel>('info');
  const [selectedTtl, setSelectedTtl] = useState(300);
  const [logLoading, setLogLoading] = useState(false);

  const handleWakeUp = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/wake-up', { method: 'POST' });
      if (res.status === 204) {
        toast.success('Cloud Run URL not configured — skipped');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        toast.success(`Wake-up: ${data.status}`);
      } else {
        toast.error(`Wake-up failed: ${data.error || data.status}`);
      }
    } catch (_err) {
      toast.error('Network error sending wake-up');
    } finally {
      setLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setLoading(true);
    setStatus('idle');
    try {
      const start = Date.now();
      const res = await fetch('/api/health?service=ai');
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setStatus('ok');
        setLatency(data.latency || Date.now() - start);
        toast.success(`System Healthy (${data.latency}ms)`);
      } else {
        setStatus('error');
        toast.error(`Health Check Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (_err) {
      setStatus('error');
      toast.error('Network error checking health');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogLevel = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await fetch('/api/admin/log-level');
      if (res.ok) {
        const data = (await res.json()) as LogLevelStatus;
        setLogStatus(data);
        if (LOG_LEVELS.includes(data.vercel.level as LogLevel)) {
          setSelectedLevel(data.vercel.level as LogLevel);
        }
      }
    } catch {
      // Silent fail — panel just shows stale/no data
    } finally {
      setLogLoading(false);
    }
  }, []);

  const handleToggleLogSection = () => {
    const next = !logExpanded;
    setLogExpanded(next);
    if (next) {
      void fetchLogLevel();
    }
  };

  const handleApplyLogLevel = async () => {
    setLogLoading(true);
    try {
      const res = await fetch('/api/admin/log-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: selectedLevel,
          target: 'all',
          ttlSeconds: selectedTtl,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          applied: Record<string, string>;
          expiresAt: string | null;
        };
        toast.success(
          `Log level → ${selectedLevel} (resets in ${selectedTtl / 60}min)`
        );
        void fetchLogLevel();
        if (data.applied.cloudRun === 'unreachable') {
          toast.error('Cloud Run unreachable — Vercel only');
        }
      } else {
        toast.error('Failed to change log level');
      }
    } catch {
      toast.error('Network error changing log level');
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
        <Zap className="h-3 w-3 text-amber-500" />
        AI Engine Controls (Debug)
      </h4>
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3 shadow-sm">
        {/* Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleWakeUp}
            disabled={loading}
            data-testid="ai-debug-start"
            className="flex items-center justify-center gap-1.5 rounded-md bg-white border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50"
            title="Send wake-up signal to Cloud Run"
          >
            <Play className="h-3.5 w-3.5 text-green-600" />
            Start
          </button>

          <button
            type="button"
            onClick={handleHealthCheck}
            disabled={loading}
            data-testid="ai-debug-check"
            className="flex items-center justify-center gap-1.5 rounded-md bg-white border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm disabled:opacity-50"
            title="Check connection health"
          >
            <Activity className="h-3.5 w-3.5 text-blue-600" />
            Check
          </button>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-between pt-1 border-t border-amber-100">
          <span className="text-xs text-gray-500">System Status:</span>
          <div className="flex items-center gap-2">
            {status === 'idle' && (
              <span className="text-xs text-gray-400">Unknown</span>
            )}
            {status === 'ok' && (
              <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Online {latency ? `(${latency}ms)` : ''}
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Log Level Section (Collapsible) */}
        <div className="border-t border-amber-100 pt-2">
          <button
            type="button"
            onClick={handleToggleLogSection}
            className="flex w-full items-center justify-between text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            <span className="flex items-center gap-1">
              {logExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Log Level
            </span>
            {logStatus && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${LEVEL_COLORS[logStatus.vercel.level as LogLevel] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
              >
                {logStatus.vercel.level}
              </span>
            )}
          </button>

          {logExpanded && (
            <div className="mt-2 space-y-2">
              {/* Level buttons */}
              <div className="flex gap-1">
                {LOG_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    disabled={logLoading}
                    className={`flex-1 rounded px-2 py-1 text-[11px] font-medium border transition-colors ${
                      selectedLevel === lvl
                        ? LEVEL_COLORS[lvl]
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    } disabled:opacity-50`}
                  >
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </button>
                ))}
              </div>

              {/* TTL + Apply */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">TTL:</span>
                <select
                  value={selectedTtl}
                  onChange={(e) => setSelectedTtl(Number(e.target.value))}
                  disabled={logLoading}
                  className="flex-1 rounded border border-gray-200 bg-white px-1.5 py-1 text-[11px] text-gray-700 disabled:opacity-50"
                >
                  {TTL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyLogLevel}
                  disabled={logLoading}
                  className="rounded bg-amber-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {logLoading ? '...' : 'Apply'}
                </button>
              </div>

              {/* Cloud Run + Default info */}
              {logStatus && (
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>
                    Cloud Run:{' '}
                    {logStatus.cloudRun.reachable
                      ? logStatus.cloudRun.level
                      : 'N/A'}
                  </span>
                  <span>Default: {logStatus.vercel.defaultLevel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
