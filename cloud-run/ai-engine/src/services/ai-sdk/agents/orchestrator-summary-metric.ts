import type {
  IntentClassification,
  QueryMetric,
  QueryOperator,
} from './orchestrator-query-intent';
import { STATUS_THRESHOLDS } from '../../../config/status-thresholds';
import {
  toNumber,
  type MetricsToolPayload,
  type ServerSnapshot,
} from './orchestrator-summary-payload';

function roundPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function buildCpuCheckItem(server: ServerSnapshot): string {
  if (server.id.includes('lb-')) {
    return 'HAProxy worker CPU, active connection, backend 분산 편차를 확인하세요.';
  }
  if (server.id.includes('api-') || server.id.includes('was-')) {
    return '상위 프로세스와 최근 배포/배치 작업의 CPU 증가 여부를 확인하세요.';
  }
  if (server.id.includes('db-')) {
    return '슬로우 쿼리, connection 수, 백그라운드 job CPU 점유를 확인하세요.';
  }
  if (server.id.includes('storage-')) {
    return 'NFS/스토리지 프로세스의 iowait 동반 여부와 클라이언트 요청 급증을 확인하세요.';
  }
  if (server.id.includes('cache-')) {
    return 'Redis command 폭증, eviction, persistence 작업 여부를 확인하세요.';
  }
  return '상위 프로세스, 예약 작업, 최근 배포 전후 CPU 변화를 확인하세요.';
}

function getDiskRiskLabel(disk: number | null): string {
  if (disk === null) return '데이터 없음';
  if (disk >= 85) return '매우 높음';
  if (disk >= 80) return '높음';
  return '주의';
}

function getDiskFailureWindow(disk: number | null): string {
  if (disk === null) return '추정 불가';
  if (disk >= 85) return '즉시~30분 내 쓰기 실패 또는 로그 적체 위험';
  if (disk >= 80) return '수 시간 내 임계치 85% 도달 가능';
  return '24시간 내 증가 추세 재확인 필요';
}

function buildDiskCheckItem(server: ServerSnapshot): string {
  if (server.id.includes('backup')) {
    return '백업 산출물 보존 기간, 증분 백업 크기, 오래된 dump 정리를 확인하세요.';
  }
  if (server.id.includes('storage-') || server.id.includes('nfs')) {
    return 'NFS/export 사용량, 대용량 파일 생성 클라이언트, inode 사용률을 확인하세요.';
  }
  if (server.id.includes('db-')) {
    return 'WAL/binlog, slow log, 임시 테이블 파일과 백업 디렉터리를 확인하세요.';
  }
  if (server.id.includes('api-') || server.id.includes('was-')) {
    return '애플리케이션 로그 회전, 업로드 임시 파일, 배포 산출물 누적을 확인하세요.';
  }
  return '로그 적체, tmp 디렉터리, 대용량 파일 생성 프로세스를 확인하세요.';
}

function getMetricLabel(metric: QueryMetric): string {
  switch (metric) {
    case 'cpu':
      return 'CPU';
    case 'memory':
      return '메모리';
    case 'disk':
      return 'DISK';
    case 'network':
      return '네트워크';
    case 'status':
      return '상태';
  }
}

function getMetricValue(server: ServerSnapshot, metric: QueryMetric): number | null {
  if (metric === 'status') return null;
  return toNumber(server[metric]);
}

function formatOperatorForTitle(operator: QueryOperator): string {
  switch (operator) {
    case '>=':
      return '이상';
    case '>':
      return '초과';
    case '<=':
      return '이하';
    case '<':
      return '미만';
    case '==':
      return '일치';
    case '!=':
      return '제외';
  }
}

function compareMetricValue(value: number, operator: QueryOperator, threshold: number): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '>=':
      return value >= threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
  }
}

function buildMetricCheckItem(metric: QueryMetric, server: ServerSnapshot): string {
  if (metric === 'cpu') {
    return buildCpuCheckItem(server);
  }
  if (metric === 'disk') {
    return buildDiskCheckItem(server);
  }
  if (metric === 'memory') {
    if (server.id.includes('redis') || server.id.includes('cache')) {
      return 'Redis used_memory, key cardinality, eviction/TTL 정책과 maxmemory 설정을 확인하세요.';
    }
    if (server.id.includes('db-')) {
      return 'buffer pool, connection 수, 임시 테이블, 쿼리 캐시/워크 메모리 사용량을 확인하세요.';
    }
    return '상위 메모리 프로세스, OOM/GC 로그, 최근 배포 후 memory leak 여부를 확인하세요.';
  }
  if (metric === 'network') {
    return '인터페이스 오류, 연결 수, LB 트래픽 분산, 비정상 egress 증가 여부를 확인하세요.';
  }
  return '상태 변화 시각, 최근 알림, 관련 로그를 확인하세요.';
}

function getMetricFailureWindow(metric: QueryMetric, value: number | null): string {
  if (metric === 'disk') {
    return getDiskFailureWindow(value);
  }
  if (value === null) {
    return '추정 불가';
  }
  if (value >= 90) {
    return '즉시 조치 필요 - 임계 상태 지속 시 서비스 영향 가능';
  }
  if (value >= 80) {
    return '수 시간 내 임계치 도달 가능 - 증가 추세 재확인 필요';
  }
  return '24시간 내 추세 재확인 필요';
}

function isStorageServer(server: ServerSnapshot): boolean {
  return /storage|nfs|s3gw|nas/i.test(server.id);
}

function formatThresholdWindow(
  metric: Exclude<QueryMetric, 'status'>,
  value: number | null
): string {
  const threshold = STATUS_THRESHOLDS[metric];
  if (value === null) return '현재 수치가 없어 예측 불가';
  if (value >= threshold.critical) {
    return `이미 위험 임계치 ${threshold.critical}% 이상입니다. 즉시 용량/쓰기 실패 영향을 확인하세요.`;
  }
  if (value >= threshold.warning) {
    return `이미 경고 임계치 ${threshold.warning}% 이상입니다. 위험 임계치 ${threshold.critical}%까지 ${Math.round(threshold.critical - value)}%p 남았습니다.`;
  }

  const gapToWarning = Math.round(threshold.warning - value);
  if (gapToWarning <= 5) {
    return `경고 임계치 ${threshold.warning}%까지 ${gapToWarning}%p 남아 다음 증가 구간에서 알림 가능성이 있습니다.`;
  }
  return `경고 임계치 ${threshold.warning}%까지 ${gapToWarning}%p 여유가 있어 24시간 내 추세 재확인이 우선입니다.`;
}

export function isMetricThresholdPredictionQuery(
  query: string,
  classification: IntentClassification
): boolean {
  const metric = classification.metric;
  if (classification.intent !== 'predictive') {
    return false;
  }
  if (metric === 'status') {
    return false;
  }

  const mentionsMetric = Boolean(metric) || /디스크|disk|스토리지|storage|nfs|cpu|메모리|memory|network|네트워크/i.test(query);
  const mentionsThreshold =
    /임계(?:치|값)|threshold|넘기\s*전|넘기|미리\s*알|고갈|부족/i.test(query);

  return mentionsMetric && mentionsThreshold;
}

export function buildMetricThresholdPredictionFromPayload(
  query: string,
  payload: MetricsToolPayload,
  classification: IntentClassification
): string | null {
  if (!isMetricThresholdPredictionQuery(query, classification)) {
    return null;
  }

  const metric: Exclude<QueryMetric, 'status'> =
    classification.metric && classification.metric !== 'status'
      ? classification.metric
      : /스토리지|storage|nfs|디스크|disk/i.test(query)
        ? 'disk'
        : 'cpu';
  const label = getMetricLabel(metric);
  const threshold = STATUS_THRESHOLDS[metric];
  const isStorageQuestion = /스토리지|storage|nfs|s3|nas/i.test(query);
  const candidates = payload.servers
    .filter((server) => server.status !== 'offline')
    .filter((server) => !isStorageQuestion || isStorageServer(server))
    .map((server) => ({ server, value: getMetricValue(server, metric) }))
    .filter((entry): entry is { server: ServerSnapshot; value: number } => entry.value !== null)
    .sort((left, right) => right.value - left.value)
    .slice(0, 3);

  if (candidates.length === 0) {
    return null;
  }

  const scopeLabel = isStorageQuestion ? '스토리지' : label;
  const lines = [
    `📈 **${scopeLabel} ${label} 임계치 사전 예측**`,
    `• 기준: 현재 스냅샷 기준, 경고 임계치 ${threshold.warning}%, 위험 임계치 ${threshold.critical}%`,
  ];

  lines.push('', '📊 **현재 사용률**');
  candidates.forEach(({ server, value }, index) => {
    lines.push(`${index + 1}. ${server.id}: 현재 ${label} ${roundPercent(value)} (상태 ${server.status})`);
  });

  lines.push('', '⏱️ **예상 리스크 윈도우**');
  candidates.forEach(({ server, value }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${formatThresholdWindow(metric, value)}`);
  });

  lines.push('', '💡 **선제 조치**');
  candidates.forEach(({ server }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${buildMetricCheckItem(metric, server)}`);
  });

  return lines.join('\n');
}

export function buildMetricThresholdFilterFromPayload(
  payload: MetricsToolPayload,
  classification: IntentClassification
): string | null {
  const metric = classification.metric;
  const operator = classification.operator;
  const threshold = classification.threshold;

  if (!metric || !operator) {
    return null;
  }

  if (metric === 'status') {
    const statusValue = classification.statusValue;
    if (!statusValue) return null;
    const matchedServers =
      payload.source === 'filterServers'
        ? payload.servers
        : payload.servers.filter((server) => server.status === statusValue);
    const total = payload.filterSummary?.total ?? payload.servers.length;
    const lines = [
      `📊 **상태 ${statusValue} 서버 ${matchedServers.length}대**`,
      `• 기준: 전체 ${total}대 중 status == ${statusValue}`,
    ];
    if (matchedServers.length === 0) {
      lines.push('• 현재 기준을 만족한 서버는 없습니다.');
      return lines.join('\n');
    }
    matchedServers.forEach((server, index) => {
      lines.push(`${index + 1}. ${server.id}: 상태 ${server.status}`);
    });
    return lines.join('\n');
  }

  if (threshold === undefined) {
    return null;
  }

  const label = getMetricLabel(metric);
  const matchedEntries =
    payload.source === 'filterServers'
      ? payload.servers
          .filter((server) => server.status !== 'offline')
          .map((server) => ({ server, value: getMetricValue(server, metric) }))
      : payload.servers
          .filter((server) => server.status !== 'offline')
          .map((server) => ({ server, value: getMetricValue(server, metric) }))
          .filter(
            (entry): entry is { server: ServerSnapshot; value: number } =>
              entry.value !== null && compareMetricValue(entry.value, operator, threshold)
          );

  const sortableEntries = matchedEntries
    .filter(
      (entry): entry is { server: ServerSnapshot; value: number } =>
        entry.value !== null
    )
    .sort((left, right) =>
      operator.includes('<') ? left.value - right.value : right.value - left.value
    );
  const matchedCount = payload.filterSummary?.matched ?? sortableEntries.length;
  const total = payload.filterSummary?.total ?? payload.servers.length;
  const lines = [
    `📊 **${label} 사용률 ${threshold}% ${formatOperatorForTitle(operator)} 서버 ${matchedCount}대**`,
    `• 기준: 전체 ${total}대 중 ${label} ${operator} ${threshold}%`,
  ];

  if (sortableEntries.length === 0) {
    lines.push('• 현재 기준을 만족한 서버는 없습니다.');
    if (payload.emptyResultHint?.topServers?.length) {
      lines.push('', '참고 상위 서버');
      payload.emptyResultHint.topServers.forEach((server, index) => {
        lines.push(`${index + 1}. ${server.id}: ${roundPercent(server.value ?? null)}`);
      });
    }
    return lines.join('\n');
  }

  sortableEntries.forEach(({ server, value }, index) => {
    lines.push(
      `${index + 1}. ${server.id}: ${label} ${roundPercent(value)} (상태 ${server.status}, 위험도 ${metric === 'disk' ? getDiskRiskLabel(value) : value >= 90 ? '매우 높음' : value >= 80 ? '높음' : '주의'})`
    );
  });

  lines.push('', '⏱️ **잠재적 장애 시점**');
  sortableEntries.forEach(({ server, value }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${getMetricFailureWindow(metric, value)}`);
  });

  lines.push('', '💡 **권장 조치**');
  sortableEntries.forEach(({ server }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${buildMetricCheckItem(metric, server)}`);
  });

  return lines.join('\n');
}

export function buildMetricRankingFromPayload(
  payload: MetricsToolPayload,
  classification: IntentClassification
): string | null {
  const metric = classification.metric;
  if (!metric || metric === 'status') {
    return null;
  }

  const requestedCount = classification.rankCount ?? 3;
  const order = classification.rankOrder ?? 'desc';
  const label = getMetricLabel(metric);
  const rankedServers = [...payload.servers]
    .filter((server) => server.status !== 'offline')
    .map((server) => ({ server, value: getMetricValue(server, metric) }))
    .filter(
      (entry): entry is { server: ServerSnapshot; value: number } =>
        entry.value !== null
    )
    .sort((left, right) =>
      order === 'asc' ? left.value - right.value : right.value - left.value
    )
    .slice(0, requestedCount);

  const lines = [
    `📊 **${label} 사용률 ${order === 'asc' ? '하위' : '상위'} ${requestedCount}대**`,
  ];
  rankedServers.forEach(({ server, value }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${label} ${roundPercent(value)}`);
  });

  lines.push('', '💡 **서버별 확인 항목**');
  rankedServers.forEach(({ server }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${buildMetricCheckItem(metric, server)}`);
  });

  return lines.join('\n');
}
