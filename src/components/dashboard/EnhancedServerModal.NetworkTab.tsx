import type { FC } from 'react';
import { getThreshold } from '@/config/rules';
import { RealtimeChart } from './EnhancedServerModal.components';
/**
 * 🌐 Enhanced Server Modal Network Tab (v2.0 간소화)
 *
 * 네트워크 모니터링 탭:
 * - 네트워크 상태 표시 (실제 데이터)
 * - 네트워크 사용률 차트 (실제 데이터)
 * - 서버 연결 정보
 *
 * ✅ v2.0 변경사항:
 * - In/Out 분리 → 단일 Network 사용률
 * - Latency 추정값 제거
 * - 불필요한 추정값 섹션 정리
 *
 * @refactored 2026-01-03 - 추정값 제거 및 간소화
 */
import type {
  NetworkStatus,
  RealtimeData,
  ServerData,
} from './EnhancedServerModal.types';

/**
 * Network Tab Props
 */
interface NetworkTabProps {
  /** 서버 데이터 */
  server: ServerData;
  /** 실시간 데이터 (네트워크 메트릭 포함) */
  realtimeData: RealtimeData;
}

/**
 * 🎨 네트워크 상태별 색상 및 표시 텍스트
 */
const getNetworkStatusInfo = (status?: NetworkStatus) => {
  switch (status) {
    case 'excellent':
      return { color: 'bg-green-400 shadow-green-400/50', text: '최상' };
    case 'good':
      return { color: 'bg-yellow-400 shadow-yellow-400/50', text: '양호' };
    case 'poor':
      return { color: 'bg-red-400 shadow-red-400/50', text: '부족' };
    case 'offline':
      return { color: 'bg-blue-400 shadow-blue-400/50', text: '오프라인' };
    default:
      return { color: 'bg-gray-400 shadow-gray-400/50', text: '알 수 없음' };
  }
};

/**
 * 🌐 Network Tab Component (v2.0)
 *
 * 서버의 네트워크 상태를 실시간으로 모니터링하는 탭
 * - 네트워크 상태 카드
 * - 네트워크 사용률 차트 (실제 데이터)
 * - 네트워크 연결 정보
 */
export const NetworkTab: FC<NetworkTabProps> = ({ server, realtimeData }) => {
  const networkStatusInfo = getNetworkStatusInfo(server.networkStatus);
  const networkThreshold = getThreshold('network');

  // 네트워크 사용률 (단일값 배열)
  const networkData = realtimeData.network;
  const latestNetwork = networkData[networkData.length - 1] || 0;

  return (
    <div className="space-y-6">
      {/* 헤더 섹션 */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <h3 className="bg-linear-to-r from-emerald-600 to-teal-700 bg-clip-text text-2xl font-bold text-transparent">
            🌐 네트워크 상태
          </h3>
          <div className="flex items-center gap-2 rounded-full bg-linear-to-r from-emerald-50 to-teal-50 px-3 py-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              실시간 업데이트
            </span>
          </div>
        </div>
      </div>

      {/* 네트워크 상태 카드들 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 네트워크 상태 카드 */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 p-6 shadow-xl">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">네트워크 상태</h4>
              <span className="text-2xl">🌍</span>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full ${networkStatusInfo.color} shadow-lg`}
              />
              <span className="text-xl font-bold text-white">
                {networkStatusInfo.text}
              </span>
            </div>
            <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
              <div className="mb-1 text-xs text-white/80">네트워크 속도</div>
              <div className="text-2xl font-bold text-white">
                {server.specs?.network_speed || '1 Gbps'}
              </div>
            </div>
          </div>
        </div>

        {/* 네트워크 사용률 카드 */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 p-6 shadow-xl">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-bold text-white">네트워크 사용률</h4>
              <span className="text-2xl">📊</span>
            </div>
            <div className="mb-2 text-4xl font-bold text-white">
              {latestNetwork.toFixed(1)}%
            </div>
            <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/80">대역폭 상태</span>
                <span
                  className={`font-bold ${
                    latestNetwork >= networkThreshold.critical
                      ? 'text-red-100'
                      : latestNetwork >= networkThreshold.warning
                        ? 'text-amber-100'
                        : 'text-emerald-100'
                  }`}
                >
                  {latestNetwork >= networkThreshold.critical
                    ? '심각'
                    : latestNetwork >= networkThreshold.warning
                      ? '경고'
                      : '양호'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 네트워크 사용률 차트 */}
      <div className="rounded-2xl bg-linear-to-br from-gray-50 to-gray-100 p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-lg font-bold text-transparent">
            네트워크 사용률 추이
          </h4>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            실시간 데이터
          </span>
        </div>
        <RealtimeChart
          data={networkData}
          color="#10b981"
          label="네트워크 사용률 (%)"
        />
      </div>

      {/* 네트워크 연결 정보 */}
      <div className="rounded-2xl bg-linear-to-br from-slate-50 to-gray-100 p-6 shadow-xl transition-shadow hover:shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h4 className="bg-linear-to-r from-slate-700 to-gray-900 bg-clip-text text-xl font-bold text-transparent">
            🔗 연결 정보
          </h4>
          <div
            className={`rounded-full px-3 py-1 ${
              latestNetwork >= networkThreshold.critical
                ? 'bg-linear-to-r from-red-100 to-rose-100'
                : latestNetwork >= networkThreshold.warning
                  ? 'bg-linear-to-r from-yellow-100 to-amber-100'
                  : 'bg-linear-to-r from-green-100 to-emerald-100'
            }`}
          >
            <span
              className={`text-xs font-medium ${
                latestNetwork >= networkThreshold.critical
                  ? 'text-red-700'
                  : latestNetwork >= networkThreshold.warning
                    ? 'text-yellow-700'
                    : 'text-green-700'
              }`}
            >
              {latestNetwork >= networkThreshold.critical
                ? '장애'
                : latestNetwork >= networkThreshold.warning
                  ? '불안정'
                  : '연결됨'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 왼쪽 컬럼 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>🌐</span> IP 주소
              </span>
              <span className="font-mono font-bold text-gray-900">
                {server.ip || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>💻</span> 호스트명
              </span>
              <span className="font-medium text-gray-900">
                {server.hostname}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>📍</span> 위치
              </span>
              <span className="font-medium text-gray-900">
                {server.location}
              </span>
            </div>
          </div>

          {/* 오른쪽 컬럼 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>☁️</span> 프로바이더
              </span>
              <span className="font-medium text-gray-900">
                {server.provider}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>🔧</span> 환경
              </span>
              <span className="font-medium capitalize text-gray-900">
                {server.environment}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white p-3 shadow-xs transition-shadow hover:shadow-md">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span>🖥️</span> 서버 타입
              </span>
              <span className="font-medium capitalize text-gray-900">
                {server.type || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
