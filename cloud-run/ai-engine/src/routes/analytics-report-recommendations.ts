import type {
  IncidentRecommendation,
  ToolBasedData,
} from './analytics-report-types';

const SEVERITY_RANK: Record<string, number> = {
  info: 0,
  low: 1,
  medium: 2,
  warning: 2,
  high: 3,
  critical: 4,
};

export function severityRank(severity?: string): number {
  return SEVERITY_RANK[severity?.toLowerCase() ?? ''] ?? 0;
}

export function maxSeverity(current: string, candidate: string): string {
  return severityRank(candidate) > severityRank(current) ? candidate : current;
}

export function toIncidentPriority(
  severity?: string
): IncidentRecommendation['priority'] {
  return severityRank(severity) >= severityRank('critical') ? 'high' : 'medium';
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function getAnomalyMetricKey(metric: string): string {
  const normalized = metric.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('mem')) return 'memory';
  if (normalized.includes('disk') || normalized.includes('fs')) return 'disk';
  if (normalized.includes('net')) return 'network';
  if (normalized.includes('cpu')) return 'cpu';
  return normalized;
}

function getAnomalyServerLabel(
  anomaly: ToolBasedData['anomalies'][number]
): string {
  return anomaly.server_name || anomaly.server_id;
}

function isLoadBalancerAnomaly(
  anomaly: ToolBasedData['anomalies'][number]
): boolean {
  const target = `${anomaly.server_id} ${anomaly.server_name}`.toLowerCase();
  return (
    target.includes('haproxy') ||
    target.includes('loadbalancer') ||
    target.includes('load-balancer') ||
    target.includes('lb-')
  );
}

function anomalyPriority(
  severity: string
): IncidentRecommendation['priority'] {
  return severity === 'critical' ? 'high' : 'medium';
}

function buildAnomalyRecommendation(
  anomaly: ToolBasedData['anomalies'][number]
): IncidentRecommendation {
  const metric = getAnomalyMetricKey(anomaly.metric);
  const label = getAnomalyServerLabel(anomaly);
  const value = `${Math.round(anomaly.value * 10) / 10}%`;
  const priority = anomalyPriority(anomaly.severity);

  if (metric === 'cpu') {
    return {
      action: `${label} CPU 상위 프로세스 확인 (${value})\n명령어: \`top -o %CPU -b -n 1 | head -20\``,
      priority,
      expected_impact: '부하 프로세스 식별 및 조치 우선순위 산정',
    };
  }

  if (metric === 'network') {
    if (isLoadBalancerAnomaly(anomaly)) {
      return {
        action: `${label} HAProxy 세션/백엔드 상태 확인 (${value})\n명령어: \`echo "show stat" | socat - /run/haproxy/admin.sock | head -20\``,
        priority,
        expected_impact: '로드밸런서 연결 쏠림과 backend 장애 여부 확인',
      };
    }

    return {
      action: `${label} 네트워크 연결/소켓 상태 확인 (${value})\n명령어: \`ss -s\``,
      priority,
      expected_impact: '연결 수 급증 또는 소켓 고갈 여부 확인',
    };
  }

  if (metric === 'memory') {
    return {
      action: `${label} 메모리 상위 프로세스 확인 (${value})\n명령어: \`ps aux --sort=-%mem | head -10\``,
      priority,
      expected_impact: '메모리 누수 또는 캐시 증가 원인 식별',
    };
  }

  if (metric === 'disk') {
    return {
      action: `${label} 디스크 사용량 상위 경로 확인 (${value})\n명령어: \`du -sh /* 2>/dev/null | sort -hr | head -10\``,
      priority,
      expected_impact: '급증한 로그/데이터 경로 식별',
    };
  }

  return {
    action: `${label} ${anomaly.metric} 임계 초과 확인 (${value})\n명령어: \`journalctl -xe --no-pager | tail -50\``,
    priority,
    expected_impact: '이상 징후 발생 시점의 시스템 로그 확인',
  };
}

export function buildAnomalyRecommendations(
  anomalies: ToolBasedData['anomalies']
): IncidentRecommendation[] {
  return anomalies.slice(0, 4).map(buildAnomalyRecommendation);
}

function normalizeRecommendationKey(action: string): string {
  return action
    .replace(/`[^`]+`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isGenericCapacityAction(action: string): boolean {
  return /서버\s*리소스\s*업그레이드|스케일\s*업|scale\s*up|증설|로드\s*밸런싱\s*조정/i.test(
    action
  );
}

export function mergeIncidentRecommendations(
  deterministic: IncidentRecommendation[],
  agent: IncidentRecommendation[]
): IncidentRecommendation[] {
  const ordered = [
    ...deterministic,
    ...agent.filter((item) => !isGenericCapacityAction(item.action)),
    ...agent.filter((item) => isGenericCapacityAction(item.action)),
  ];
  const seen = new Set<string>();
  const merged: IncidentRecommendation[] = [];

  for (const item of ordered) {
    const key = normalizeRecommendationKey(item.action);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 6) break;
  }

  return merged;
}
