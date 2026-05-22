import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
} from '../../core/assistant-runtime';
import { getMonitoringPeakMetric, type PeakMetricSlot } from './peak-metric';
import {
  type ParsedPeakMetricRequest,
  parseMonitoringPeakMetricFrame,
  parseMonitoringPeakMetricMessage,
} from './peak-metric-intent';

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

function formatMetricValue(value: number, unit = ''): string {
  return `${formatNumber(value)}${unit}`;
}

function buildPeakMetricFallbackAnswer(
  peak: PeakMetricSlot,
  includeReadOnlyAdvice: boolean
): string {
  const topServers = peak.topServers
    .map(
      (server, index) =>
        `${index + 1}. ${server.name} (${server.id}): ${formatMetricValue(
          server.value,
          peak.unit
        )}`
    )
    .join('\n');
  const fallbackNotice = peak.usedFallbackMetric
    ? `- 참고: 요청 지표 원천 데이터가 없어 ${peak.sourceLabel}을 대체 지표로 사용했습니다.`
    : null;

  return [
    `지난 ${peak.windowHours}시간 기준 ${peak.sourceLabel} 최고 시간대는 ${peak.dateLabel} ${peak.timeLabel}입니다.`,
    '',
    `- 기준: monitoring OTel 슬롯의 서버별 ${peak.sourceLabel} 최대값`,
    `- 최고값: ${formatMetricValue(peak.value, peak.unit)}`,
    `- 상위 평균: ${formatMetricValue(peak.averageTopValue, peak.unit)}`,
    fallbackNotice,
    '',
    '상위 서버',
    topServers,
    '',
    '운영 해석: 이 시간대는 관측 창 안에서 순간 피크가 가장 컸던 구간입니다. 같은 계층의 서버가 함께 높다면 배치, 트래픽 집중, 또는 upstream 병목을 우선 확인하는 것이 좋습니다.',
    includeReadOnlyAdvice
      ? [
          '',
          '읽기 전용 확인 항목',
          '1. 피크 시간대 상위 서버에서 `uptime`, `top -b -n1 -o %CPU`, `ps -eo pid,ppid,cmd,%cpu,%mem --sort=-%cpu | head`로 현재 부하와 상위 프로세스를 확인합니다.',
          '2. 같은 시간대 애플리케이션/DB 로그와 배치 스케줄을 조회해 트래픽 집중, 배치 실행, upstream 병목 여부를 대조합니다.',
          '3. 패키지 설치, 서비스 재시작, 파일 삭제, 설정 변경은 이 근거만으로 제안하지 말고 별도 승인 절차 이후에만 검토합니다.',
        ].join('\n')
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function buildPeakMetricPrompt(peak: PeakMetricSlot): string {
  const topServers = peak.topServers
    .map((server) => `${server.id}=${formatMetricValue(server.value, peak.unit)}`)
    .join(', ');
  const fallbackNotice = peak.usedFallbackMetric
    ? ` 요청 지표의 원천 데이터가 없어 ${peak.sourceLabel}을 대체 지표로 사용했다는 점을 명시하세요.`
    : '';

  return [
    '[결정적 monitoring 피크 지표 근거]',
    `질문은 지난 ${peak.windowHours}시간의 ${peak.sourceLabel} 최고 시간대를 묻고 있습니다.`,
    `최고 시간대: ${peak.dateLabel} ${peak.timeLabel} (${peak.fullTimestamp})`,
    `최고값: ${formatMetricValue(peak.value, peak.unit)}`,
    `상위 평균: ${formatMetricValue(peak.averageTopValue, peak.unit)}`,
    `상위 서버: ${topServers}`,
    '위 수치와 시간대를 바꾸지 말고, 첫 문장에 결론을 답하세요.',
    `그 다음 1-2문장으로 운영 관점 해석을 덧붙이세요.${fallbackNotice}`,
    '사용자가 대응/조치 방법을 함께 물어도 이 근거만으로 패키지 설치, 서비스 재시작, 파일 삭제, 설정 변경 같은 변형 명령어를 제안하지 말고 읽기 전용 확인 항목으로 제한하세요.',
  ].join('\n');
}

function parsePeakMetricRequest(
  request: DomainEvidenceRequest
): ParsedPeakMetricRequest | null {
  if (request.intentFrame) {
    return parseMonitoringPeakMetricFrame(request);
  }

  return parseMonitoringPeakMetricMessage(request.message);
}

export const monitoringPeakMetricEvidenceProvider: DomainEvidenceProvider = {
  id: 'monitoring-peak-metric',
  canHandle(request: DomainEvidenceRequest): boolean {
    return parsePeakMetricRequest(request) !== null;
  },
  async resolve(request: DomainEvidenceRequest) {
    const parsed = parsePeakMetricRequest(request);
    if (!parsed) return null;

    const peak = getMonitoringPeakMetric(parsed);
    if (!peak) return null;

    const responsePolicy = parsed.responseGuidanceRequested
      ? 'deterministic_read_only_advice'
      : 'deterministic_answer';

    return {
      id: 'monitoring-peak-metric',
      prompt: buildPeakMetricPrompt(peak),
      fallback: buildPeakMetricFallbackAnswer(
        peak,
        parsed.responseGuidanceRequested === true
      ),
      metadata: {
        metric: peak.requestedMetric,
        sourceMetric: peak.sourceKey,
        windowHours: peak.windowHours,
        slotIndex: peak.slotIndex,
        timestamp: peak.fullTimestamp,
        ...(parsed.responseGuidanceRequested && {
          responseGuidanceRequested: true,
        }),
        ...(responsePolicy && { responsePolicy }),
        ...(parsed.capabilityId && { capabilityId: parsed.capabilityId }),
        ...(parsed.intent && { intent: parsed.intent }),
      },
    };
  },
};
