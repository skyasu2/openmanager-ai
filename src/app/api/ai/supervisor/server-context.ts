/**
 * 서버 컨텍스트 주입 - AI 응답에 Monitoring Pipeline 분석 결과 제공
 *
 * MonitoringContext의 분석 결과(Health Score, Alert, 그룹별 현황)를
 * system message로 주입하여 AI가 구체적 데이터 기반 답변을 생성하도록 함
 *
 * @updated 2026-02-04 - Pre-computed 데이터 + PromQL rate() 트렌드
 */

import type { NormalizedMessage } from '@/lib/ai/utils/message-normalizer';
import { MonitoringContext } from '@/services/monitoring/MonitoringContext';

export async function buildServerContextMessage(): Promise<NormalizedMessage | null> {
  try {
    const monitoring = MonitoringContext.getInstance();
    const context = await monitoring.getLLMContext();

    if (!context) return null;

    // PromQL로 최근 트렌드 추가
    let trendContext = '';
    try {
      const cpuRate = await monitoring.queryMetric(
        'rate(node_cpu_utilization_ratio[1h])'
      );
      if (cpuRate.result.length > 0) {
        const rising = cpuRate.result.filter((r) => r.value > 5);
        const dropping = cpuRate.result.filter((r) => r.value < -5);

        if (rising.length > 0 || dropping.length > 0) {
          trendContext += '\nTrend (1h):';
          if (rising.length > 0) {
            trendContext += ` CPU rising: ${rising
              .slice(0, 3)
              .map((r) => `${r.labels.instance ?? 'unknown'}(+${r.value}%)`)
              .join(', ')}`;
          }
          if (dropping.length > 0) {
            trendContext += ` CPU dropping: ${dropping
              .slice(0, 3)
              .map((r) => `${r.labels.instance ?? 'unknown'}(${r.value}%)`)
              .join(', ')}`;
          }
          trendContext += '\n';
        }
      }
    } catch {
      // PromQL trend is best-effort, ignore errors
    }

    return {
      role: 'system',
      content: `${context}${trendContext}\n위 모니터링 데이터를 참조하여 구체적으로 답변하세요.`,
    };
  } catch {
    return null;
  }
}
