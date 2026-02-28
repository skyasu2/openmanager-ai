import { formatBytes } from './utils-functions';

/**
 * 메트릭 값 포맷팅 유틸리티
 *
 * @param metric - 메트릭 이름 (cpu, memory, disk, network, responseTime 등)
 * @param value - 메트릭 값 (cpu/mem/disk/network: %, responseTime: ms)
 * @returns 포맷된 문자열
 *
 * NOTE: OTel 파이프라인에서 network 값은 0~1 ratio → *100 = 퍼센트(%)로
 * 변환되어 저장됩니다. 따라서 network도 % 단위 메트릭으로 처리합니다.
 */
export function formatMetricValue(metric: string, value: number): string {
  // camelCase를 "_" 구분자로 정규화: "responseTime" → "response_time"
  const normalizedKey = metric
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();

  // word-boundary 매칭: "disk_io"가 "disk"에, "duration"이 "io"에 걸리지 않도록
  const wordMatch = (keyword: string) =>
    new RegExp(`(^|[_.-])${keyword}([_.-]|$)`).test(normalizedKey) ||
    normalizedKey === keyword;

  // 1. 바이트 단위 메트릭 (bytes_received, bytes_sent, io_read 등)
  // ※ "duration"의 "io" 오매칭 방지를 위해 퍼센트/시간보다 먼저, word-boundary로 검사
  if (wordMatch('bytes') || wordMatch('io')) {
    return `${formatBytes(value)}/s`;
  }

  // 2. 응답 시간 (ms) — "duration", "latency", "*_time" 등
  if (wordMatch('time') || wordMatch('duration') || wordMatch('latency')) {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}s`;
    }
    return `${Math.round(value)}ms`;
  }

  // 3. 퍼센트 단위 메트릭 (cpu, memory, disk, network 모두 % 단위)
  if (
    ['cpu', 'memory', 'disk', 'filesystem', 'usage', 'network'].some((k) =>
      normalizedKey.includes(k)
    )
  ) {
    return `${Number(value).toFixed(1)}%`;
  }

  // 4. (Fallback) 기본 숫자 포맷
  return value.toLocaleString();
}

/**
 * 메트릭 레이블(이름) 포맷팅
 *
 * @param metric - 메트릭 키 (예: cpu, network)
 * @returns 사용자 친화적 이름 (예: CPU Usage, Network Traffic)
 */
export function formatMetricName(metric: string): string {
  const map: Record<string, string> = {
    cpu: 'CPU',
    memory: 'Memory',
    disk: 'Disk',
    network: 'Network I/O',
    responseTime: 'Response Time',
    up: 'Uptime',
  };

  return map[metric] || metric.charAt(0).toUpperCase() + metric.slice(1);
}
