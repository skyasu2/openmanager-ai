/**
 * 📊 Enhanced Server Modal Overview Tab
 *
 * Server overview display component:
 * - 3D resource gauges (CPU, Memory, Disk)
 * - System information card
 * - Service status monitoring
 * - Real-time updates with animated indicators
 */
import { Activity, Server as ServerIcon } from 'lucide-react';
import type { FC } from 'react';
import { ServerModal3DGauge } from '../shared/UnifiedCircularGauge';
import { StatusLED } from './EnhancedServerModal.components';
import type { ServerData, StatusTheme } from './EnhancedServerModal.types';

/**
 * Overview Tab Props
 */
interface OverviewTabProps {
  /** 서버 데이터 */
  server: ServerData;
  /** 상태별 테마 정보 */
  statusTheme: StatusTheme;
}

/**
 * 📋 Overview Tab Component
 *
 * 서버의 전반적인 상태를 한눈에 볼 수 있는 개요 탭
 * - 실시간 리소스 모니터링 (3D 게이지)
 * - 시스템 정보 및 서비스 상태
 * - 반응형 디자인 및 부드러운 애니메이션
 */
export const OverviewTab: FC<OverviewTabProps> = ({ server, statusTheme }) => {
  return (
    <div className="space-y-6">
      {/* 3D 게이지들 - 개선된 디자인 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="bg-linear-to-r from-gray-700 to-gray-900 bg-clip-text text-2xl font-bold text-transparent">
            실시간 리소스 모니터링
          </h3>
          <div className="flex items-center gap-2">
            <StatusLED status="running" size={8} animated={true} />
            <span className="text-sm font-medium text-gray-600">
              실시간 업데이트 중
            </span>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-8 rounded-2xl bg-linear-to-br ${statusTheme.bgLight} border backdrop-blur-sm ${statusTheme.borderColor} p-8 shadow-xl md:grid-cols-3`}
        >
          {/* CPU 게이지 */}
          <div>
            <ServerModal3DGauge
              value={server.cpu}
              label="CPU"
              type="cpu"
              size={160}
            />
          </div>

          {/* 메모리 게이지 */}
          <div>
            <ServerModal3DGauge
              value={server.memory}
              label="메모리"
              type="memory"
              size={160}
            />
          </div>

          {/* 디스크 게이지 */}
          <div>
            <ServerModal3DGauge
              value={server.disk}
              label="디스크"
              type="disk"
              size={160}
            />
          </div>
        </div>
      </div>

      {/* 시스템 정보 - 개선된 카드 디자인 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 시스템 정보 카드 */}
        <div className="group">
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
            {/* 배경 그라데이션 효과 */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-50 to-transparent opacity-50" />

            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
                  <ServerIcon className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">시스템 정보</h4>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: '운영체제',
                    value: server.os || 'Ubuntu 22.04',
                    icon: '🐧',
                  },
                  {
                    label: 'IP 주소',
                    value: server.ip || '192.168.1.100',
                    icon: '🌐',
                  },
                  {
                    label: '업타임',
                    value: server.uptime,
                    icon: '⏱️',
                  },
                  {
                    label: '마지막 업데이트',
                    value: '방금 전',
                    icon: '🔄',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="font-medium text-gray-600">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={`font-semibold ${
                        item.label === 'IP 주소'
                          ? 'rounded bg-gray-100 px-2 py-1 font-mono text-sm'
                          : 'text-gray-800'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 서비스 상태 카드 */}
        <div className="group">
          <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all duration-300 hover:shadow-2xl">
            {/* 배경 그라데이션 효과 */}
            <div className="absolute inset-0 bg-linear-to-br from-green-50 to-transparent opacity-50" />

            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 text-green-600">
                  <Activity className="h-5 w-5" />
                </div>
                <h4 className="text-lg font-bold text-gray-800">서비스 상태</h4>
              </div>

              <div className="space-y-3">
                {server.services && server.services.length > 0 ? (
                  server.services.map((service, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-linear-to-r from-gray-50 to-transparent p-3 transition-all hover:from-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <StatusLED
                          status={
                            service.status === 'running' ? 'running' : 'stopped'
                          }
                          size={12}
                          animated={service.status === 'running'}
                        />
                        <span className="font-semibold text-gray-700">
                          {service.name}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-xs ${
                          service.status === 'running'
                            ? 'bg-linear-to-r from-green-100 to-green-200 text-green-800'
                            : service.status === 'stopped'
                              ? 'bg-linear-to-r from-red-100 to-red-200 text-red-800'
                              : 'bg-linear-to-r from-amber-100 to-amber-200 text-amber-800'
                        }`}
                      >
                        {service.status === 'running'
                          ? '✅ 실행중'
                          : service.status === 'stopped'
                            ? '🛑 중지됨'
                            : '⏸️ 대기중'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <div className="mb-2 text-4xl">📋</div>
                    <div className="font-medium text-gray-500">
                      등록된 서비스가 없습니다
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      이 서버에 모니터링 대상 서비스가 구성되지 않았습니다
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
