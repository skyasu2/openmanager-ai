/**
 * 🚀 Server Statistics Web Worker
 * 백그라운드에서 서버 통계 계산을 수행하여 메인 스레드 블로킹 방지
 *
 * 성능 최적화:
 * - Map 기반 고속 그룹핑
 * - 병렬 계산 처리
 * - 메모리 효율적 알고리즘
 */

// 🛡️ Type Guard 함수들 (Worker 환경용)
const isValidServer = (value) => {
  return value !== null &&
         typeof value === 'object' &&
         typeof value.id === 'string' &&
         typeof value.status === 'string';
};

const isValidNumber = (value) => {
  return typeof value === 'number' &&
         !Number.isNaN(value) &&
         Number.isFinite(value) &&
         value >= 0;
};

const isValidArray = (value) => {
  return Array.isArray(value) && value.length > 0;
};

/**
 * 🧮 서버 통계 계산 (Map 기반 최적화)
 * 복잡도: O(n) - 단일 패스 알고리즘
 */
const calculateServerStats = (servers) => {
  const startTime = performance.now();

  if (!isValidArray(servers)) {
    return {
      total: 0,
      online: 0,
      offline: 0,
      warning: 0,
      critical: 0,
      averageCpu: 0,
      averageMemory: 0,
      averageUptime: 0,
      totalBandwidth: 0,
      typeDistribution: new Map(),
      performanceMetrics: {
        calculationTime: 0,
        serversProcessed: 0
      }
    };
  }

  // Map 기반 고속 집계
  const statusMap = new Map();
  const typeMap = new Map();
  let cpuSum = 0;
  let memorySum = 0;
  let uptimeSum = 0;
  let bandwidthSum = 0;
  let validServersCount = 0;

  // 🚀 단일 패스 계산 (O(n))
  for (const server of servers) {
    if (!isValidServer(server)) continue;

    validServersCount++;

    // 상태별 집계
    const status = server.status || 'unknown';
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    // 타입별 집계
    const type = server.type || 'unknown';
    typeMap.set(type, (typeMap.get(type) || 0) + 1);

    // 메트릭 합계 (안전한 숫자 검증)
    if (isValidNumber(server.cpu)) cpuSum += server.cpu;
    if (isValidNumber(server.memory)) memorySum += server.memory;
    if (isValidNumber(server.uptime)) uptimeSum += server.uptime;
    if (isValidNumber(server.bandwidth)) bandwidthSum += server.bandwidth;
  }

  // 평균 계산 (0으로 나누기 방지)
  const safeAverage = (sum, count) => count > 0 ? sum / count : 0;

  const endTime = performance.now();

  return {
    total: validServersCount,
    online: statusMap.get('online') || 0,
    offline: statusMap.get('offline') || 0,
    warning: statusMap.get('warning') || 0,
    critical: statusMap.get('critical') || 0,
    averageCpu: safeAverage(cpuSum, validServersCount),
    averageMemory: safeAverage(memorySum, validServersCount),
    averageUptime: safeAverage(uptimeSum, validServersCount),
    totalBandwidth: bandwidthSum,
    typeDistribution: Object.fromEntries(typeMap),
    performanceMetrics: {
      calculationTime: endTime - startTime,
      serversProcessed: validServersCount
    }
  };
};

/**
 * 📊 페이지네이션 계산 (최적화된 수학적 접근)
 */
const calculatePagination = (totalItems, currentPage, itemsPerPage) => {
  if (!isValidNumber(totalItems) || !isValidNumber(currentPage) || !isValidNumber(itemsPerPage)) {
    return {
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      startIndex: 0,
      endIndex: 0
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  return {
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
    startIndex,
    endIndex,
    currentPage: safePage
  };
};

/**
 * 🎯 필터링 최적화 (Set 기반 O(1) 룩업)
 */
const applyFilters = (servers, filters) => {
  if (!isValidArray(servers) || !filters) {
    return servers || [];
  }

  const { status, type, search } = filters;

  // Set 기반 필터 (O(1) 룩업)
  const statusSet = status && status.length > 0 ? new Set(status) : null;
  const typeSet = type && type.length > 0 ? new Set(type) : null;
  const searchLower = search ? search.toLowerCase() : null;

  return servers.filter(server => {
    if (!isValidServer(server)) return false;

    // 상태 필터
    if (statusSet && !statusSet.has(server.status)) return false;

    // 타입 필터
    if (typeSet && !typeSet.has(server.type)) return false;

    // 검색 필터 (이름과 IP 동시 검색)
    if (searchLower) {
      const name = (server.name || '').toLowerCase();
      const ip = (server.ip || '').toLowerCase();
      if (!name.includes(searchLower) && !ip.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
};

// 🔄 Worker 메시지 핸들러
self.onmessage = function(e) {
  const { type, data, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'CALCULATE_STATS':
        result = calculateServerStats(data.servers);
        break;

      case 'CALCULATE_PAGINATION':
        result = calculatePagination(data.totalItems, data.currentPage, data.itemsPerPage);
        break;

      case 'APPLY_FILTERS':
        result = applyFilters(data.servers, data.filters);
        break;

      case 'COMBINED_CALCULATION':
        // 🚀 통합 계산 (한 번의 Worker 호출로 모든 계산 수행)
        const filteredServers = applyFilters(data.servers, data.filters);
        const stats = calculateServerStats(filteredServers);
        const pagination = calculatePagination(
          filteredServers.length,
          data.currentPage,
          data.itemsPerPage
        );

        result = {
          filteredServers,
          stats,
          pagination,
          totalFiltered: filteredServers.length
        };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // 성공 응답
    self.postMessage({
      type: 'SUCCESS',
      id,
      data: result
    });

  } catch (error) {
    // 에러 응답
    self.postMessage({
      type: 'ERROR',
      id,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// 🎯 Worker 초기화 완료 신호
self.postMessage({
  type: 'WORKER_READY',
  timestamp: Date.now(),
  message: 'Server Statistics Worker initialized successfully'
});