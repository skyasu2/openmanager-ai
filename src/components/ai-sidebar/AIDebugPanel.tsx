'use client';

import { Activity, Play, Zap } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function AIDebugPanel() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [latency, setLatency] = useState<number | null>(null);

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
      </div>
    </div>
  );
}
