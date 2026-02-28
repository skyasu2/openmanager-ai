'use client';

import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronDown,
  Clock,
  Database,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { formatUptime } from '@/utils/serverUtils';

interface EnhancedProfileStatusDisplayProps {
  compact?: boolean;
}

export function EnhancedProfileStatusDisplay({
  compact = false,
}: EnhancedProfileStatusDisplayProps) {
  const { status, isLoading, error, refresh } = useSystemStatus();
  const [showDetails, setShowDetails] = useState(false);

  // 환경 표시 이름 변환
  const getEnvironmentDisplay = (env: string): string => {
    switch (env) {
      case 'production':
        return 'Production';
      case 'development':
        return 'Development';
      case 'test':
        return 'Test';
      default:
        return env;
    }
  };

  // 로딩 스켈레톤 UI
  if (isLoading) {
    return (
      <div
        data-testid="status-skeleton"
        className={`${compact ? 'p-2' : 'p-3'} animate-pulse rounded-lg bg-gray-50`}
      >
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gray-300" />
          <div className="h-4 w-20 rounded bg-gray-300" />
        </div>
        {!compact && (
          <div className="mt-2 space-y-1">
            <div className="h-3 w-16 rounded bg-gray-300" />
            <div className="h-3 w-24 rounded bg-gray-300" />
          </div>
        )}
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        data-testid="error-display"
        className={`${compact ? 'p-2' : 'p-3'} rounded-lg border border-red-200 bg-red-50`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span className="text-sm text-red-700">상태 확인 실패</span>
        </div>
        {!compact && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const getStatusColor = () => {
    if (status?.isStarting) return 'text-yellow-500';
    if (status?.isRunning) return 'text-green-500';
    return 'text-red-500';
  };

  const getStatusText = () => {
    if (status?.isStarting) return '시스템 시작 중...';
    if (status?.isRunning) return '시스템 실행 중';
    return '시스템 중지됨';
  };

  return (
    <div
      className={`${compact ? 'p-2' : 'p-3'} rounded-lg bg-gray-50`}
      data-testid={compact ? 'compact-layout' : 'full-layout'}
    >
      {/* 기본 상태 표시 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity
              data-testid="system-status-indicator"
              className={`h-4 w-4 ${getStatusColor()} ${
                status?.isRunning ? 'animate-pulse' : ''
              }`}
            />
            {status?.isStarting && (
              <div
                data-testid="loading-spinner"
                className="absolute inset-0 animate-spin"
              >
                <RefreshCw className="h-4 w-4 text-yellow-500" />
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">
            {getStatusText()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* 새로고침 버튼 */}
          <button
            type="button"
            data-testid="refresh-button"
            onClick={refresh}
            className="rounded p-1 transition-colors hover:bg-gray-200"
            title="상태 새로고침"
          >
            <RefreshCw className="h-3 w-3 text-gray-500" />
          </button>

          {/* 상세 정보 토글 */}
          {!compact && (
            <button
              type="button"
              data-testid="detail-toggle"
              onClick={() => setShowDetails(!showDetails)}
              className="rounded p-1 transition-colors hover:bg-gray-200"
            >
              <ChevronDown
                className={`h-3 w-3 text-gray-500 transition-transform ${
                  showDetails ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* 컴팩트 모드가 아닐 때 기본 정보 표시 */}
      {!compact && status && (
        <div
          data-testid="full-layout"
          className="mt-2 grid grid-cols-2 gap-2 text-xs"
        >
          <div className="col-span-2 flex items-center gap-1">
            <Server className="h-3 w-3 text-purple-500" />
            <span data-testid="version-display" className="text-gray-600">
              v{status.version || '0.0.0'}
            </span>
          </div>

          {status.uptime > 0 && (
            <div className="col-span-2 flex items-center gap-1">
              <Clock className="h-3 w-3 text-green-500" />
              <span data-testid="uptime-display" className="text-gray-600">
                가동시간: {formatUptime(status.uptime, { locale: 'ko' })}
              </span>
            </div>
          )}

          <div className="col-span-2 flex items-center gap-1">
            <span
              data-testid="environment-display"
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                status.environment === 'production'
                  ? 'bg-green-100 text-green-700'
                  : status.environment === 'development'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {getEnvironmentDisplay(status.environment || 'unknown')}
            </span>
          </div>
        </div>
      )}

      {/* 상세 정보 (토글 가능) */}
      {showDetails && !compact && (
        <div
          data-testid="detailed-info"
          className="mt-3 border-t border-gray-200 pt-3"
        >
          <div className="mb-2 text-xs font-medium text-gray-600">
            서비스 상태
          </div>

          <div className="space-y-2">
            {/* 데이터베이스 상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3 text-blue-500" />
                <span className="text-xs text-gray-700">데이터베이스</span>
              </div>
              <div
                data-testid="database-status"
                className={`h-2 w-2 rounded-full ${
                  status?.services?.database ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </div>

            {/* 캐시 상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span className="text-xs text-gray-700">캐시</span>
              </div>
              <div
                data-testid="cache-status"
                className={`h-2 w-2 rounded-full ${
                  status?.services?.cache ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </div>

            {/* AI 서비스 상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-3 w-3 text-purple-500" />
                <span className="text-xs text-gray-700">AI 서비스</span>
              </div>
              <div
                data-testid="ai-status"
                className={`h-2 w-2 rounded-full ${
                  status?.services?.ai ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
            </div>
          </div>

          {/* 마지막 업데이트 시간 */}
          {status?.lastUpdate && (
            <div className="mt-3 border-t border-gray-200 pt-2">
              <div className="text-xs text-gray-500">
                마지막 업데이트:{' '}
                {new Date(status.lastUpdate).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
