import type {
  QueryMetric,
  QueryOperator,
  QueryRankOrder,
  QueryStatus,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import type { MetricCondition } from './current-metrics-directional-conditions';

export type CurrentMetricsEvidenceIntent =
  | 'metric_current'
  | 'metric_ranking'
  | 'metric_trend'
  | 'server_health';
export type SupportedMetric = Exclude<QueryMetric, 'status'>;
export type { MetricCondition };
export type TrendDirection = 'increase' | 'decrease';
export type TrendRankBy = 'current' | 'delta';

export interface ParsedCurrentMetricsEvidenceRequest {
  intent: CurrentMetricsEvidenceIntent;
  capabilityId: string;
  sourceIntent: string;
  answerQuery: string;
  targets?: string[];
  /** targets가 현재 메시지의 명시 ID/그룹이 아닌 이전 turn(팔로업)에서 유래했는지 */
  contextualTargets?: boolean;
  groupTargets?: string[];
  metric?: SupportedMetric;
  sourceMetric?: SupportedMetric;
  metrics?: SupportedMetric[];
  threshold?: number;
  thresholdOperator?: QueryOperator;
  filterOperator?: 'AND' | 'OR';
  metricConditions?: MetricCondition[];
  filterConditions?: MetricCondition[];
  rankCount?: number;
  rankOrder?: QueryRankOrder;
  rankRange?: 'top-bottom';
  rankBasis?: 'composite-load';
  statusFilter?: 'healthy-only' | QueryStatus;
  trendDirection?: TrendDirection;
  trendRankBy?: TrendRankBy;
}
