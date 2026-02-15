'use client';

/**
 * 🚀 Enhanced Server Detail Modal v5.2 - Light Mode UI
 *
 * 완전히 모듈화된 현대적 서버 상세 모달 (Light Theme 적용):
 * - Clean White Background (깔끔한 화이트 배경)
 * - Subtle Shadows (부드러운 그림자 효과)
 * - Professional Light Mode (가독성 향상)
 */

import { Activity, BarChart3, Cpu, FileText, Network } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useServerMetrics } from '@/hooks/useServerMetrics';
import { logger } from '@/lib/logging';

import { LogsTab } from './EnhancedServerModal.LogsTab';
import { MetricsTab } from './EnhancedServerModal.MetricsTab';
import { NetworkTab } from './EnhancedServerModal.NetworkTab';
import { OverviewTab } from './EnhancedServerModal.OverviewTab';
import { ProcessesTab } from './EnhancedServerModal.ProcessesTab';
import type {
  EnhancedServerModalProps,
  RealtimeData,
  ServerData,
  TabId,
  TabInfo,
} from './EnhancedServerModal.types';
import {
  getStatusTheme,
  normalizeServerData,
} from './EnhancedServerModal.utils';
import { ServerModalHeader } from './ServerModalHeader';
import { ServerModalTabNav } from './ServerModalTabNav';

export default function EnhancedServerModal({
  server,
  onClose,
}: EnhancedServerModalProps) {
  // 🎯 React Hooks는 항상 최상단에서 호출
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [isRealtime, setIsRealtime] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // 🕒 OTel TimeSeries 기반 서버 메트릭 히스토리 훅
  const { metricsHistory, loadMetricsHistory } = useServerMetrics();

  useEffect(() => {
    if (server?.id) {
      // 모달 오픈 시 24시간 히스토리 로드
      loadMetricsHistory(server.id, '24h');
    }
  }, [server?.id, loadMetricsHistory]);

  // 📅 마지막 업데이트 시간
  const lastUpdateTime = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }, []); // Props로 전달된 server 정보가 변경될 때 갱신

  // 🔧 P2: 핸들러 최적화 - useCallback으로 불필요한 리렌더 방지
  const handleToggleRealtime = useCallback(() => {
    setIsRealtime((prev) => !prev);
  }, []);

  const handleTabSelect = useCallback((tabId: TabId) => {
    setSelectedTab(tabId);
  }, []);

  // ♿ 접근성: 포커스 트랩 (모달 내부에서만 Tab 키 이동)
  const getFocusableElements = useCallback(() => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC 키로 모달 닫기
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      // Tab 키 트랩
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!firstElement || !lastElement) return;

        if (event.shiftKey) {
          // Shift+Tab: 첫 요소에서 마지막으로 이동
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: 마지막 요소에서 첫 요소로 이동
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // 모달 열릴 때 첫 번째 포커스 가능 요소에 포커스
    const focusableElements = getFocusableElements();
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, getFocusableElements]);

  // 🛡️ 서버 데이터 안전성 검증 및 기본값 설정
  const safeServer = useMemo(
    (): ServerData | null => (server ? normalizeServerData(server) : null),
    [server]
  );

  // 📅 로그 타임스탬프 메모이제이션
  const logTimestamp = useMemo(() => new Date().toISOString(), []);

  // 📈 최신 메트릭 (히스토리 마지막 항목, 없으면 undefined)
  const currentMetrics = useMemo(
    () =>
      metricsHistory.length > 0
        ? metricsHistory[metricsHistory.length - 1]
        : undefined,
    [metricsHistory]
  );

  // RealtimeData 변환 (metricsHistory -> UI 포맷)
  const realtimeData: RealtimeData = useMemo(() => {
    if (!safeServer)
      return {
        cpu: [],
        memory: [],
        disk: [],
        network: [],
        logs: [],
      };

    return {
      cpu: metricsHistory.map((h) => h.cpu),
      memory: metricsHistory.map((h) => h.memory),
      disk: metricsHistory.map((h) => h.disk),
      // 📊 네트워크: In/Out 분리 데이터 없음 → NetworkTab에서 단일 사용률로 표시
      network: metricsHistory.map((h) => {
        const net = typeof h.network === 'number' ? h.network : 0;
        return { in: net * 0.6, out: net * 0.4 };
      }),
      // 📋 시스템 알림: hourly-data 로그에서 WARN/ERROR 필터링
      logs: (() => {
        const serverLogs = server?.logs;
        if (serverLogs && serverLogs.length > 0) {
          // hourly-data 원본 로그에서 WARN/ERROR 추출
          const alerts = serverLogs
            .filter((log) => log.level === 'WARN' || log.level === 'ERROR')
            .map((log) => ({
              timestamp: log.timestamp || logTimestamp,
              level: log.level.toLowerCase() as 'warn' | 'error',
              message: log.message,
              source: 'syslog',
            }));

          if (alerts.length === 0) {
            return [
              {
                timestamp: logTimestamp,
                level: 'info' as const,
                message: '모든 시스템 지표가 정상 범위 내에 있습니다.',
                source: 'syslog',
              },
            ];
          }
          return alerts;
        }

        // fallback: 로그 데이터 없음
        return [
          {
            timestamp: logTimestamp,
            level: 'info' as const,
            message: '로그 데이터를 불러오는 중입니다.',
            source: 'system',
          },
        ];
      })(),
    };
  }, [metricsHistory, safeServer, logTimestamp, server?.logs]);

  // 📊 탭 구성 최적화
  const tabs: TabInfo[] = [
    { id: 'overview', label: '종합 상황', icon: Activity },
    { id: 'metrics', label: '성능 분석', icon: BarChart3 },
    { id: 'logs', label: '로그 & 네트워크', icon: FileText },
  ];

  if (!safeServer) {
    logger.warn('⚠️ [EnhancedServerModal] 서버 데이터가 없습니다.');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <button
          type="button"
          className="absolute inset-0 h-full w-full cursor-default"
          onClick={onClose}
          aria-label="Close modal"
        />
        <div
          className="relative w-full max-w-md rounded-xl bg-white p-6 text-center border border-gray-200 shadow-xl"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="mb-4 text-4xl text-red-500">⚠️</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            서버 데이터 오류
          </h3>
          <p className="mb-4 text-gray-600">서버 정보를 불러올 수 없습니다.</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="gpu-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <button
        type="button"
        aria-label="모달 닫기"
        className="absolute inset-0 h-full w-full cursor-pointer"
        onClick={onClose}
      />
      <dialog
        ref={dialogRef}
        open
        className="gpu-modal-content relative flex h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 sm:h-[90vh] sm:rounded-3xl"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* 헤더 - Light Mode Style */}
        <div className="bg-linear-to-r from-slate-50 to-gray-100 border-b border-gray-200 p-4 sm:p-6">
          <ServerModalHeader
            server={safeServer}
            isRealtime={isRealtime}
            onToggleRealtime={handleToggleRealtime}
            onClose={onClose}
          />

          <ServerModalTabNav
            tabs={tabs}
            selectedTab={selectedTab}
            onTabSelect={handleTabSelect}
          />
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto bg-linear-to-br from-gray-50 to-white">
          <div
            key={selectedTab}
            id={`panel-${selectedTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${selectedTab}`}
            className="p-4 sm:p-6 animate-fade-in-up"
          >
            {/* 📊 통합 탭 시스템 */}
            {selectedTab === 'overview' && (
              <div className="space-y-6">
                <OverviewTab
                  server={safeServer}
                  statusTheme={getStatusTheme(safeServer.status)}
                />

                {/* 📈 핵심 메트릭 요약 - Light Mode Card */}
                <div className="rounded-xl p-5 bg-white shadow-sm border border-gray-200">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    핵심 성능 지표
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                    <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div
                        className={`text-2xl font-bold ${
                          safeServer.cpu > 80
                            ? 'text-red-600'
                            : safeServer.cpu > 60
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {Math.round(safeServer.cpu)}%
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-1 tracking-wider">
                        CPU
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div
                        className={`text-2xl font-bold ${
                          safeServer.memory > 80
                            ? 'text-red-600'
                            : safeServer.memory > 60
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {Math.round(safeServer.memory)}%
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-1 tracking-wider">
                        Memory
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div
                        className={`text-2xl font-bold ${
                          safeServer.disk > 80
                            ? 'text-red-600'
                            : safeServer.disk > 60
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {Math.round(safeServer.disk)}%
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-1 tracking-wider">
                        Disk
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-2xl font-bold text-blue-600">
                        {safeServer.services?.length || 0}
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-1 tracking-wider">
                        Services
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedTab === 'metrics' && (
              <div className="space-y-6">
                <MetricsTab
                  server={safeServer}
                  realtimeData={realtimeData}
                  isRealtime={isRealtime}
                  onToggleRealtime={handleToggleRealtime}
                />

                <div className="rounded-xl p-5 bg-white shadow-sm border border-gray-200">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Cpu className="h-5 w-5 text-emerald-600" />
                    서비스 목록
                  </h3>
                  <ProcessesTab services={safeServer.services} />
                </div>
              </div>
            )}

            {selectedTab === 'logs' && (
              <div className="space-y-6">
                <div className="rounded-xl p-5 bg-white shadow-sm border border-gray-200">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <FileText className="h-5 w-5 text-blue-600" />
                    시스템 로그
                  </h3>
                  <LogsTab
                    serverId={safeServer.id}
                    serverMetrics={{
                      cpu: currentMetrics?.cpu ?? safeServer.cpu,
                      memory: currentMetrics?.memory ?? safeServer.memory,
                      disk: currentMetrics?.disk ?? safeServer.disk,
                      network:
                        (typeof currentMetrics?.network === 'number'
                          ? currentMetrics.network
                          : null) ??
                        safeServer.network ??
                        0,
                    }}
                    realtimeData={realtimeData}
                    serverContext={{
                      hostname: safeServer.hostname || safeServer.id,
                      environment: safeServer.environment || 'production',
                      datacenter: safeServer.location || 'Seoul-ICN-AZ1',
                      serverType: safeServer.type || 'web',
                    }}
                    serverLogs={server?.logs}
                    structuredLogs={server?.structuredLogs}
                  />
                </div>

                <div className="rounded-xl p-5 bg-white shadow-sm border border-gray-200">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <Network className="h-5 w-5 text-purple-600" />
                    네트워크 상태
                  </h3>
                  <NetworkTab server={safeServer} realtimeData={realtimeData} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 상태 요약 */}
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:gap-4 sm:text-sm">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5 ${
                    safeServer.status === 'online'
                      ? 'bg-emerald-500'
                      : safeServer.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className="font-medium capitalize text-gray-700">
                  {safeServer.status}
                </span>
              </div>
              <div className="text-gray-300 hidden sm:block">|</div>
              <div className="text-gray-600">
                <span className="hidden sm:inline">
                  CPU: {Math.round(safeServer.cpu)}% · Mem:{' '}
                  {Math.round(safeServer.memory)}%
                </span>
                <span className="sm:hidden">
                  {Math.round(safeServer.cpu)}% /{' '}
                  {Math.round(safeServer.memory)}%
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-400 font-mono">
              LAST UPDATE: {lastUpdateTime}
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
