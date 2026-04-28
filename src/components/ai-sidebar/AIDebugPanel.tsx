'use client';

import { Activity, Zap } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface AIDebugPanelProps {
  title?: string;
  showStatus?: boolean;
}

export function AIDebugPanel({
  title = 'AI 엔진 상태',
  showStatus = true,
}: AIDebugPanelProps = {}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [latency, setLatency] = useState<number | null>(null);

  const handleAction = async () => {
    setLoading(true);
    try {
      // Wake-up first if idle/error, then health check
      if (status !== 'ok') {
        const wakeRes = await fetch('/api/ai/wake-up', { method: 'POST' });
        if (wakeRes.status !== 204 && !wakeRes.ok) {
          const wakeData = await wakeRes.json();
          toast.error(`웜업 실패: ${wakeData.error || wakeData.status}`);
        }
      }

      const start = Date.now();
      const res = await fetch('/api/health?service=ai');
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setStatus('ok');
        setLatency(data.latency || Date.now() - start);
        toast.success(`AI 엔진 정상 (${data.latency ?? Date.now() - start}ms)`);
      } else {
        setStatus('error');
        toast.error(`연결 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (_err) {
      setStatus('error');
      toast.error('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
        <Zap className="h-3 w-3 text-amber-500" />
        {title}
      </h4>
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          {/* Status */}
          {showStatus && (
            <div className="flex items-center gap-2">
              {status === 'idle' && (
                <span className="text-xs text-gray-400">확인 안 됨</span>
              )}
              {status === 'ok' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  온라인{latency ? ` (${latency}ms)` : ''}
                </span>
              )}
              {status === 'error' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  오프라인
                </span>
              )}
            </div>
          )}

          {/* Action button */}
          <button
            type="button"
            onClick={handleAction}
            disabled={loading}
            data-testid="ai-debug-check"
            className="flex min-h-6 min-w-6 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Activity className="h-3.5 w-3.5 text-blue-600" />
            {loading ? '확인 중…' : status === 'ok' ? '재확인' : '상태 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
