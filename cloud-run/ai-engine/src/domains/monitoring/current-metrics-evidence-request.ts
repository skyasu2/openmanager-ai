import type { DomainEvidenceRequest } from '../../core/assistant-runtime';
import {
  FORCE_KB_QUERY_PATTERN,
  shouldPreferAdvisorForOperationalAdvice,
} from '../../services/ai-sdk/routing/query-routing-signals';
import { EXPLICIT_RCA_QUERY_PATTERN } from './current-metrics-evidence-patterns';
import { parseCurrentMetricsFrame } from './current-metrics-evidence-frame-parser';
import { parseCurrentMetricsMessage } from './current-metrics-evidence-message-parser';
import type { ParsedCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request-types';
import {
  extractServerIdTargetsFromMessage,
  inferGroupTargetFromMessage,
} from './current-metrics-request-helpers';

export type {
  CurrentMetricsEvidenceIntent,
  MetricCondition,
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
  TrendDirection,
  TrendRankBy,
} from './current-metrics-evidence-request-types';

export function parseCurrentMetricsEvidenceRequest(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  if (FORCE_KB_QUERY_PATTERN.test(request.message)) return null;
  if (shouldPreferAdvisorForOperationalAdvice(request.message)) return null;
  if (EXPLICIT_RCA_QUERY_PATTERN.test(request.message)) return null;

  const parsed =
    parseCurrentMetricsFrame(request) ?? parseCurrentMetricsMessage(request);

  // 팔로업 대명사("방금 분석한 서버 중 …")로 해석된 타깃은, 현재 메시지에
  // 명시 서버 ID나 그룹 힌트가 없을 때 이전 turn에서 추출된 것이다. 이 경우
  // 답변 라벨이 서버 타입명("로드밸런서 1대")으로 표기되면 일반 그룹 조회와
  // 구분되지 않으므로, 컨텍스트 유래임을 표시해 "지정 서버"로 라벨링한다.
  if (parsed?.targets && parsed.targets.length > 0) {
    const explicitTargets = extractServerIdTargetsFromMessage(request.message);
    const groupTarget = inferGroupTargetFromMessage(request.message);
    if (explicitTargets.length === 0 && !groupTarget) {
      return { ...parsed, contextualTargets: true };
    }
  }

  return parsed;
}
