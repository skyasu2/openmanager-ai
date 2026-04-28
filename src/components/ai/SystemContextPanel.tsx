'use client';

/**
 * SystemContextPanel - AI Workspace 우측 패널
 *
 * @description
 * - AI Provider 상태 실시간 표시 (config/ai-providers.ts 기반)
 * - 시스템 상태 모니터링 (useHealthCheck 훅 사용)
 * - 빠른 명령 힌트
 * - AI 디버그 패널
 *
 * @since v7.1.0 - useHealthCheck 통합으로 중복 폴링 제거
 */

import { Activity, AlertCircle, Layout, RefreshCw, Server } from 'lucide-react';
import { memo, useMemo } from 'react';
import { AIDebugPanel } from '@/components/ai-sidebar/AIDebugPanel';
import { AI_PROVIDERS, type AIProviderConfig } from '@/config/ai-providers';
import {
  type HealthStatus,
  useHealthCheck,
} from '@/hooks/system/useHealthCheck';
import { formatTime } from '@/lib/format-date';

/**
 * AI Provider 상태 타입 - AIProviderConfig 기반 확장
 * @see config/ai-providers.ts
 */
type AIProviderStatus = Pick<AIProviderConfig, 'name' | 'role' | 'color'> & {
  status: 'active' | 'configured' | 'error';
};

type SystemContextPanelProps = {
  className?: string;
  finalProvider?: string;
};

const SystemContextPanel = memo(function SystemContextPanel({
  className = '',
  finalProvider,
}: SystemContextPanelProps) {
  // useHealthCheck 훅으로 통합 (10분 데이터 주기 기준으로 폴링 최소화)
  const {
    providers: healthProviders,
    status: healthStatus,
    lastChecked,
    isChecking,
    check,
    error,
  } = useHealthCheck({
    pollingInterval: 600000, // 10분 (서버 데이터 갱신 주기 정렬)
    pauseWhenHidden: true,
    service: 'ai',
  });

  // Provider 상태 매핑 (config + health 병합)
  const providers: AIProviderStatus[] = useMemo(() => {
    return AI_PROVIDERS.map((configProvider) => {
      const healthProvider = healthProviders.find(
        (hp) => hp.name.toLowerCase() === configProvider.name.toLowerCase()
      );
      const status: AIProviderStatus['status'] =
        healthProvider?.status === 'active'
          ? 'active'
          : healthProvider?.status === 'error'
            ? 'error'
            : 'configured';

      return {
        name: configProvider.name,
        role: configProvider.role,
        color: configProvider.color,
        status,
      };
    });
  }, [healthProviders]);

  const activeProviderKey = finalProvider?.trim().toLowerCase() ?? '';

  const getStatusBadge = (status: AIProviderStatus['status']) => {
    switch (status) {
      case 'active':
        return (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
            Active
          </span>
        );
      case 'configured':
        return (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Configured
          </span>
        );
      case 'error':
        return (
          <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
            Error
          </span>
        );
    }
  };

  const systemStatusConfig = useMemo(() => {
    const configs: Record<
      HealthStatus,
      { label: string; className: string; description: string }
    > = {
      healthy: {
        label: 'Online',
        className: 'text-emerald-600',
        description: 'AI Engine is responding normally.',
      },
      checking: {
        label: 'Checking',
        className: 'text-blue-600',
        description: 'Health check in progress.',
      },
      degraded: {
        label: 'Degraded',
        className: 'text-amber-600',
        description: 'Health endpoint responded but reported a degraded state.',
      },
      error: {
        label: 'Error',
        className: 'text-red-600',
        description: error ?? 'Unable to reach the AI Engine health endpoint.',
      },
      unknown: {
        label: 'Unknown',
        className: 'text-gray-500',
        description: 'No health result has been collected yet.',
      },
    };

    return configs[healthStatus];
  }, [error, healthStatus]);

  return (
    <div
      className={`flex w-[320px] flex-col border-l border-gray-200 bg-gray-50 ${className}`}
    >
      {/* 헤더 */}
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Activity className="h-4 w-4 text-blue-500" />
          System Context
        </h3>
        <button
          type="button"
          onClick={() => void check()}
          disabled={isChecking}
          className="inline-flex min-h-6 min-w-6 items-center justify-center rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-hidden"
          title="새로고침"
        >
          <RefreshCw
            className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* AI Provider Status */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Provider Routing
          </h4>
          <div className="space-y-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            {providers.map((provider) => {
              const providerKey = provider.name.toLowerCase();
              const isActiveProvider = activeProviderKey === providerKey;

              return (
                <div
                  key={provider.name}
                  className={`flex items-center justify-between rounded border px-2 py-1.5 ${
                    isActiveProvider
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-transparent bg-white text-gray-600'
                  }`}
                  data-active-provider={String(isActiveProvider)}
                  data-testid={`provider-chip-${providerKey}`}
                >
                  <span
                    className={`flex items-center gap-2 text-sm ${
                      isActiveProvider ? 'text-primary-foreground' : ''
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${provider.color}`}
                    />
                    {provider.name}
                    <span
                      className={`text-xs ${
                        isActiveProvider
                          ? 'text-primary-foreground/80'
                          : 'text-gray-400'
                      }`}
                    >
                      ({provider.role})
                    </span>
                  </span>
                  {getStatusBadge(provider.status)}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">
            표시 역할은 현재 라우팅 정책 기준이며, 실제 요청별 선택은 쿼리
            유형과 fallback 상태에 따라 달라집니다.
          </p>
          <p
            className="text-right text-xs text-gray-400"
            suppressHydrationWarning
          >
            Updated: {formatTime(lastChecked)}
          </p>
        </div>

        {/* System Status */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">
            System Status
          </h4>
          <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Server className="h-3.5 w-3.5 text-blue-500" />
                AI Engine
              </span>
              <span
                className={`flex items-center gap-1 text-sm font-bold ${systemStatusConfig.className}`}
                data-status={healthStatus}
                data-testid="ai-engine-health-badge"
                title={systemStatusConfig.description}
              >
                {(healthStatus === 'error' || healthStatus === 'degraded') && (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {(healthStatus === 'checking' || isChecking) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {systemStatusConfig.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Layout className="h-3.5 w-3.5 text-purple-500" />
                Environment
              </span>
              <span className="text-sm font-medium text-gray-900">
                Production
              </span>
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Quick Commands
          </h4>
          <div className="space-y-1.5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            <p className="flex items-center gap-1.5">
              <span className="font-medium">서버 상태 요약</span>
              <span className="text-blue-500">- 전체 현황 파악</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="font-medium">CPU 80% 이상 서버</span>
              <span className="text-blue-500">- 자연어 쿼리</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="font-medium">장애 보고서 생성</span>
              <span className="text-blue-500">- 자동 리포트</span>
            </p>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="border-t border-gray-200 pt-4">
          <AIDebugPanel title="Manual Health Check" showStatus={false} />
        </div>
      </div>
    </div>
  );
});

SystemContextPanel.displayName = 'SystemContextPanel';

export default SystemContextPanel;
