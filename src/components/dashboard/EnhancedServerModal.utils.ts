/**
 * 🔧 Enhanced Server Modal Utility Functions
 *
 * Utility functions for server modal operations:
 * - Metric color determination based on server status and values
 * - Status theme configuration for UI styling
 * - Color and gradient calculations for different server states
 */

import { getThreshold } from '@/config/rules';
import type { Server } from '@/types/server';
import type { ServerStatus } from '@/types/server-enums';
import { formatUptime } from '@/utils/serverUtils';
import type {
  MetricColorResult,
  NetworkStatus,
  ServerData,
  ServerService,
  StatusTheme,
} from './EnhancedServerModal.types';

/**
 * 🎨 메트릭별 색상 결정 함수 (서버 상태 우선)
 *
 * @param value - 메트릭 값 (0-100)
 * @param type - 메트릭 타입 ('cpu' | 'memory' | 'disk' | 'network')
 * @param serverStatus - 서버 전체 상태
 * @returns 색상과 그라데이션 정보
 */
export const getMetricColorByStatus = (
  value: number,
  type: 'cpu' | 'memory' | 'disk' | 'network',
  serverStatus: string
): MetricColorResult => {
  // 서버 상태 정규화 (critical → offline 매핑)
  const normalizedStatus =
    serverStatus === 'critical' ? 'offline' : serverStatus;

  // 서버 상태별 색상 정의
  if (normalizedStatus === 'offline') {
    // 심각 상황 - 빨간색 계열
    return {
      color: '#dc2626', // red-600
      gradient: 'from-red-500 to-red-600',
    };
  } else if (normalizedStatus === 'warning') {
    // 경고 상황 - 노랑/주황 계열
    return {
      color: '#f59e0b', // amber-500
      gradient: 'from-amber-500 to-amber-600',
    };
  } else if (normalizedStatus === 'online') {
    // 정상 상황 - 녹색 계열
    return {
      color: '#10b981', // emerald-500
      gradient: 'from-emerald-500 to-emerald-600',
    };
  }

  // 서버 상태가 불명확한 경우 메트릭 값 기반 판단 (SSOT: system-rules.json)
  const threshold = getThreshold(type);
  if (value >= threshold.critical) {
    return {
      color: '#dc2626', // red-600
      gradient: 'from-red-500 to-red-600',
    };
  } else if (value >= threshold.warning) {
    return {
      color: '#f59e0b', // amber-500
      gradient: 'from-amber-500 to-amber-600',
    };
  } else {
    return {
      color: '#10b981', // emerald-500
      gradient: 'from-emerald-500 to-emerald-600',
    };
  }
};

/**
 * 🎨 상태별 색상 테마 가져오기
 *
 * @param status - 서버 상태
 * @returns 전체 테마 설정 객체
 */
export const getStatusTheme = (status?: ServerStatus): StatusTheme => {
  switch (status) {
    case 'online': // 🔧 수정: 'healthy' → 'online' (타입 통합)
      return {
        gradient: 'from-green-500 to-emerald-600',
        bgLight: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-700',
        badge: 'bg-green-100 text-green-800',
        icon: '✅',
      };
    case 'warning':
      return {
        gradient: 'from-yellow-500 to-amber-600',
        bgLight: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-700',
        badge: 'bg-yellow-100 text-yellow-800',
        icon: '⚠️',
      };
    case 'critical':
    case 'offline':
      return {
        gradient: 'from-red-500 to-rose-600',
        bgLight: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-700',
        badge: 'bg-red-100 text-red-800',
        icon: '🚨',
      };
    default:
      return {
        gradient: 'from-gray-500 to-slate-600',
        bgLight: 'bg-gray-50',
        borderColor: 'border-gray-200',
        textColor: 'text-gray-700',
        badge: 'bg-gray-100 text-gray-800',
        icon: '❓',
      };
  }
};

/**
 * 🔍 메트릭 값의 상태 분류
 *
 * @param value - 메트릭 값 (0-100)
 * @param type - 메트릭 타입
 * @returns 상태 문자열 ('normal' | 'warning' | 'critical')
 */
const _getMetricStatus = (
  value: number,
  type: 'cpu' | 'memory' | 'disk' | 'network'
): 'normal' | 'warning' | 'critical' => {
  const threshold = getThreshold(type);

  if (value >= threshold.critical) return 'critical';
  if (value >= threshold.warning) return 'warning';
  return 'normal';
};

/**
 * 📊 차트 데이터 정규화 (0-100 범위로 제한)
 *
 * @param data - 원본 데이터 배열
 * @returns 정규화된 데이터 배열
 */
const _normalizeChartData = (data: number[]): number[] => {
  return data.map((value) => Math.max(0, Math.min(100, value)));
};

function deriveNetworkStatus(
  status: ServerStatus | undefined,
  network: number
): NetworkStatus {
  if (status === 'offline') return 'offline';

  const threshold = getThreshold('network');
  if (network >= threshold.critical) return 'poor';
  if (status === 'online' && network < threshold.warning * 0.6)
    return 'excellent';
  return 'good';
}

/**
 * 서버 원본 데이터를 모달용 안전한 ServerData로 변환
 *
 * 방어적 타입 검증 + 기본값 설정을 서비스 레이어에서 처리하여
 * 컴포넌트는 이미 검증된 데이터만 수신하도록 분리
 */
export function normalizeServerData(server: Server): ServerData {
  const cpu = typeof server.cpu === 'number' ? server.cpu : 0;
  const memory = typeof server.memory === 'number' ? server.memory : 0;
  const network = typeof server.network === 'number' ? server.network : 0;

  return {
    id: server.id || 'unknown',
    hostname:
      server.hostname ||
      server.name?.toLowerCase().replace(/\s+/g, '-') ||
      '미확인 호스트',
    name: server.name || '서버',
    type: server.type || 'unknown',
    environment: server.environment || 'production',
    location: server.location || '위치 미지정',
    provider:
      server.provider ||
      (server.environment === 'production' ? 'Cloud Provider' : 'Local'),
    status: server.status || 'unknown',
    cpu,
    memory,
    disk: typeof server.disk === 'number' ? server.disk : 0,
    network,
    uptime: formatUptime(server.uptime),
    lastUpdate: server.lastUpdate || new Date(),
    alerts:
      typeof server.alerts === 'number'
        ? server.alerts
        : Array.isArray(server.alerts)
          ? server.alerts.length
          : 0,
    services:
      Array.isArray(server.services) && server.services.length > 0
        ? server.services.map((s) => ({
            name: s?.name || 'unknown',
            status: s?.status || 'unknown',
            port: s?.port || 80,
          }))
        : getDefaultServicesByType(server.type, server.name),
    specs: server.specs || { cpu_cores: 4, memory_gb: 8, disk_gb: 100 },
    os: server.os || 'Unknown OS',
    ip: server.ip || '-',
    networkStatus: deriveNetworkStatus(server.status, network),
    health: server.health || {
      score: 0,
      trend: [],
      status: server.status || 'unknown',
    },
    alertsSummary: server.alertsSummary || {
      total: 0,
      critical: 0,
      warning: 0,
    },
  };
}

/**
 * 서버 타입/이름 기반 기본 서비스 목록 생성
 * hourly-data에 services 필드가 없을 때 사용
 */
function getDefaultServicesByType(
  type?: string,
  name?: string
): ServerService[] {
  const t = type?.toLowerCase() || '';
  const n = name?.toLowerCase() || '';

  if (t === 'loadbalancer' || n.includes('haproxy') || n.includes('lb')) {
    return [
      { name: 'HAProxy', status: 'running', port: 80 },
      { name: 'Keepalived', status: 'running', port: 112 },
    ];
  }
  if (t === 'webserver' || n.includes('nginx') || n.includes('web')) {
    return [
      { name: 'Nginx', status: 'running', port: 80 },
      { name: 'Nginx SSL', status: 'running', port: 443 },
    ];
  }
  if (t === 'database' || n.includes('mysql') || n.includes('db')) {
    return [
      { name: 'MySQL', status: 'running', port: 3306 },
      { name: 'MySQL Exporter', status: 'running', port: 9104 },
    ];
  }
  if (t === 'cache' || n.includes('redis') || n.includes('cache')) {
    return [
      { name: 'Redis', status: 'running', port: 6379 },
      { name: 'Redis Sentinel', status: 'running', port: 26379 },
    ];
  }
  if (t === 'storage' || n.includes('nfs') || n.includes('storage')) {
    return [
      { name: 'NFS Server', status: 'running', port: 2049 },
      { name: 'Node Exporter', status: 'running', port: 9100 },
    ];
  }
  if (t === 'monitoring' || n.includes('monitor') || n.includes('prometheus')) {
    return [
      { name: 'Prometheus', status: 'running', port: 9090 },
      { name: 'Grafana', status: 'running', port: 3000 },
    ];
  }
  if (n.includes('api') || n.includes('was')) {
    return [
      { name: 'Node.js App', status: 'running', port: 3000 },
      { name: 'PM2 Daemon', status: 'running', port: 9615 },
    ];
  }
  // 기본값: node exporter만
  return [{ name: 'Node Exporter', status: 'running', port: 9100 }];
}
