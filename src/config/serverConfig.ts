/**
 * 🎯 서버 데이터 생성 중앙 설정
 *
 * 서버 개수를 중앙에서 관리하고, 이에 따라 다른 설정들이 자동으로 조정됩니다.
 */

import { logger } from '@/lib/logging';
import { SERVER_DATA_INTERVAL_MS } from './server-data-polling';

export interface ServerGenerationConfig {
  // 기본 서버 설정
  maxServers: number;

  // 시나리오 설정 (서버 개수에 따라 자동 계산)
  scenario: {
    criticalCount: number; // 심각한 상태 서버 수
    warningPercent: number; // 경고 상태 서버 비율
    tolerancePercent: number; // 허용 오차 비율
  };

  // 서버 타입 할당 설정 (동적 서버 수 지원)
  serverTypes?: {
    orderedTypes: string[]; // 서버 타입 순서대로 할당
    statusMapping: {
      critical: number[]; // 심각 상태 서버 인덱스 배열
      warning: number[]; // 경고 상태 서버 인덱스 배열
      normal: number[]; // 정상 상태 서버 인덱스 배열
    };
  };

  // 페이지네이션 설정
  pagination: {
    defaultPageSize: number; // 기본 페이지 크기
    maxPageSize: number; // 최대 페이지 크기
  };

  // 캐시 설정
  cache: {
    updateInterval: number; // 업데이트 간격 (ms)
    expireTime: number; // 캐시 만료 시간 (ms)
  };

  // 성능 설정
  performance: {
    batchSize: number; // 배치 처리 크기
    bufferSize: number; // 버퍼 크기
  };
}

/**
 * 🎯 기본 서버 개수 (15개로 확장 - 더 현실적인 장애 시나리오)
 */
export const DEFAULT_SERVER_COUNT = 15;

/**
 * 🧮 서버 개수에 따른 자동 설정 계산
 */
export function calculateServerConfig(
  serverCount: number = DEFAULT_SERVER_COUNT
): ServerGenerationConfig {
  // 🎯 서버 상태 분포 비율 (DEFAULT_SERVER_COUNT=15 기준)
  const criticalPercent = 0.25; // 25% 심각 상태
  const warningPercent = 0.375; // 37.5% 경고 상태
  const tolerancePercent = 0.05; // 5% 변동값 (±5%)

  // 심각 상태 서버 수 계산 (비율 기반)
  const criticalCount = Math.max(1, Math.floor(serverCount * criticalPercent));

  // 페이지네이션 설정 (서버 개수에 따라 조정)
  const defaultPageSize =
    serverCount <= 15 ? serverCount : Math.min(12, Math.ceil(serverCount / 2));
  const maxPageSize = Math.min(50, serverCount);

  // 성능 설정 (서버 개수에 따라 조정)
  const batchSize = Math.min(100, Math.max(10, Math.ceil(serverCount / 2)));
  const bufferSize = Math.min(1000, serverCount * 10);

  // 캐시 설정 (서버 데이터 10분 슬롯 기준)
  const updateInterval = calculateOptimalCollectionInterval();
  const expireTime = SERVER_DATA_INTERVAL_MS;

  return {
    maxServers: serverCount,
    scenario: {
      criticalCount,
      warningPercent,
      tolerancePercent,
    },
    pagination: {
      defaultPageSize,
      maxPageSize,
    },
    cache: {
      updateInterval,
      expireTime,
    },
    performance: {
      batchSize,
      bufferSize,
    },
  };
}

/**
 * 🎯 데이터 수집 간격 계산 (서버 데이터 10분 슬롯 고정)
 * - 환경변수 DATA_COLLECTION_INTERVAL이 설정되어도 10분 미만으로는 내려가지 않는다.
 */
export function calculateOptimalCollectionInterval(): number {
  const envValue = process.env.DATA_COLLECTION_INTERVAL;
  if (!envValue) {
    return SERVER_DATA_INTERVAL_MS;
  }

  const parsed = Number.parseInt(envValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    logger.warn(
      `[serverConfig] Invalid DATA_COLLECTION_INTERVAL="${envValue}", fallback to ${SERVER_DATA_INTERVAL_MS}ms`
    );
    return SERVER_DATA_INTERVAL_MS;
  }

  // 10분 미만 폴링은 금지
  return Math.max(parsed, SERVER_DATA_INTERVAL_MS);
}

/**
 * 🎯 기본 서버 설정 (DEFAULT_SERVER_COUNT 기준)
 */
const DEFAULT_SERVER_CONFIG =
  calculateServerConfig(DEFAULT_SERVER_COUNT);

/**
 * 🌍 환경별 서버 설정 (로컬/Vercel 통일)
 */
export function getEnvironmentServerConfig(): ServerGenerationConfig {
  let serverCount = DEFAULT_SERVER_COUNT;

  // 환경변수로 오버라이드 (NaN/음수 방어)
  const rawCount = process.env.SERVER_COUNT ?? process.env.MAX_SERVERS;
  if (rawCount) {
    const parsed = Number.parseInt(rawCount, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      logger.warn(
        `[serverConfig] Invalid SERVER_COUNT/MAX_SERVERS="${rawCount}", fallback to ${DEFAULT_SERVER_COUNT}`
      );
    } else {
      serverCount = parsed;
    }
  }

  return calculateServerConfig(serverCount);
}

/**
 * 🎯 현재 활성 서버 설정
 */
export const ACTIVE_SERVER_CONFIG = getEnvironmentServerConfig();

/**
 * 🏢 서버 인덱스로 타입 가져오기
 */
export function getServerTypeByIndex(index: number): string {
  const config = ACTIVE_SERVER_CONFIG;
  if (
    config.serverTypes &&
    index >= 0 &&
    index < config.serverTypes.orderedTypes.length
  ) {
    return config.serverTypes.orderedTypes[index] ?? 'web';
  }
  // 폴백: 기본 타입
  const fallbackTypes = [
    'web',
    'app',
    'api',
    'database',
    'cache',
    'storage',
    'load-balancer',
    'backup',
  ];
  return fallbackTypes[index % fallbackTypes.length] ?? 'web';
}

/**
 * 🚦 서버 인덱스로 상태 가져오기
 */
export function getServerStatusByIndex(
  index: number
): 'online' | 'warning' | 'critical' {
  const config = ACTIVE_SERVER_CONFIG;
  if (config.serverTypes) {
    if (config.serverTypes.statusMapping.critical.includes(index)) {
      return 'critical';
    }
    if (config.serverTypes.statusMapping.warning.includes(index)) {
      return 'warning';
    }
    if (config.serverTypes.statusMapping.normal.includes(index)) {
      return 'online';
    }
  }
  // 폴백: 기본 상태 (인덱스 기반)
  if (index <= 1) return 'critical'; // 처음 2개
  if (index <= 4) return 'warning'; // 다음 3개
  return 'online'; // 나머지 3개
}

/**
 * 📊 서버 인덱스별 전체 정보 가져오기
 */
export function getServerInfoByIndex(index: number) {
  return {
    index,
    type: getServerTypeByIndex(index),
    status: getServerStatusByIndex(index),
    name: `${getServerTypeByIndex(index)}-${String(index + 1).padStart(2, '0')}`,
  };
}

/**
 * 📋 전체 서버 정보 배열 생성 (현재: 15개)
 */
export function getAllServersInfo() {
  return Array.from({ length: ACTIVE_SERVER_CONFIG.maxServers }, (_, index) =>
    getServerInfoByIndex(index)
  );
}

/**
 * 📊 서버 설정 정보 로깅
 */
function logServerConfig(
  config: ServerGenerationConfig = ACTIVE_SERVER_CONFIG
): void {
  logger.info('🎯 서버 데이터 생성 설정:');
  logger.info(`  📊 총 서버 수: ${config.maxServers}개`);
  logger.info(
    `  🚨 심각 상태: ${config.scenario.criticalCount}개 (${Math.round((config.scenario.criticalCount / config.maxServers) * 100)}%)`
  );
  logger.info(
    `  ⚠️  경고 상태: ${Math.round(config.scenario.warningPercent * 100)}%`
  );

  // 서버 타입 정보 로깅
  if (config.serverTypes) {
    logger.info('  🏢 서버 타입 할당:');
    const { serverTypes } = config;
    serverTypes.orderedTypes.forEach((type, index) => {
      let status = '🟢 정상';
      if (serverTypes.statusMapping.critical.includes(index)) {
        status = '🔴 심각';
      } else if (serverTypes.statusMapping.warning.includes(index)) {
        status = '🟡 경고';
      }
      logger.info(`    ${index + 1}. ${type} (${status})`);
    });
  }

  logger.info(
    `  📄 페이지 크기: ${config.pagination.defaultPageSize}개 (최대 ${config.pagination.maxPageSize}개)`
  );
  logger.info(`  🔄 업데이트 간격: ${config.cache.updateInterval / 1000}초`);
  logger.info(`  ⚡ 배치 크기: ${config.performance.batchSize}개`);

  // 전체 서버 정보 로깅
  logger.info('\n  📋 전체 서버 정보:');
  getAllServersInfo().forEach((server) => {
    const statusIcon =
      server.status === 'critical'
        ? '🔴'
        : server.status === 'warning'
          ? '🟡'
          : '🟢';
    logger.info(`    ${server.name}: ${server.type} ${statusIcon}`);
  });
}
