import type { SupervisorMode } from '../supervisor-types';
import {
  CAPACITY_FULL_FORECAST_PATTERN,
  isRestartNeededLookupQuery,
} from './routing-patterns';
import {
  ACTION_PATTERN,
  ADVISOR_QUERY_PATTERN,
  ANALYST_QUERY_PATTERN,
  ATTACHMENT_VISION_PATTERN,
  COMPOSITE_QUERY_PATTERNS,
  EXPLICIT_RANKING_REQUEST_PATTERN,
  FORCE_KB_QUERY_PATTERN,
  FORMATTING_ONLY_ACTION_PATTERN,
  FORMATTING_ONLY_EXECUTION_PATTERN,
  FORMATTING_ONLY_TARGET_PATTERN,
  MUTATING_COMMAND_PATTERN,
  REPORTER_QUERY_PATTERN,
  SERVER_GROUP_PATTERN,
  SERVER_ID_PATTERN,
  TOOL_ROUTING_PATTERNS,
  WHOLE_FLEET_PATTERN,
} from './routing-keywords';
import type {
  QueryRoutingMetric,
  QueryRoutingScope,
  QueryRoutingSignals,
  QueryRoutingTimeWindow,
  QueryRoutingToolIntentCategory,
} from './routing-signals-types';

export { isRestartNeededLookupQuery as isRestartNeededLookup };

export function isFormattingOnlyReportRequest(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  return (
    FORMATTING_ONLY_TARGET_PATTERN.test(normalizedQuery) &&
    FORMATTING_ONLY_ACTION_PATTERN.test(normalizedQuery) &&
    !FORMATTING_ONLY_EXECUTION_PATTERN.test(normalizedQuery)
  );
}

export function shouldPreferAdvisorForOperationalAdvice(
  query: string
): boolean {
  const normalized = query.toLowerCase().trim();
  if (!ADVISOR_QUERY_PATTERN.test(normalized)) return false;
  return (
    SERVER_ID_PATTERN.test(normalized) &&
    !EXPLICIT_RANKING_REQUEST_PATTERN.test(normalized)
  );
}

export function mapQuerySignalsToIntentCategory(
  signals: QueryRoutingSignals
): QueryRoutingToolIntentCategory {
  return signals.toolIntentCategory;
}

export function hasCompositeSignal(query: string): boolean {
  return COMPOSITE_QUERY_PATTERNS.some((pattern) => pattern.test(query));
}

export function detectToolIntentCategory(
  query: string
): QueryRoutingToolIntentCategory {
  const q = query.toLowerCase();
  if (isRestartNeededLookupQuery(q)) return 'metrics';
  if (TOOL_ROUTING_PATTERNS.anomaly.test(q)) return 'anomaly';
  if (
    TOOL_ROUTING_PATTERNS.prediction.test(q) ||
    CAPACITY_FULL_FORECAST_PATTERN.test(q)
  )
    return 'prediction';
  if (TOOL_ROUTING_PATTERNS.math.test(q)) return 'math';
  if (TOOL_ROUTING_PATTERNS.rca.test(q)) return 'rca';
  if (TOOL_ROUTING_PATTERNS.advisor.test(q)) return 'advisor';
  if (TOOL_ROUTING_PATTERNS.logs.test(q)) return 'logs';
  if (TOOL_ROUTING_PATTERNS.serverGroup.test(q)) return 'serverGroup';
  if (TOOL_ROUTING_PATTERNS.metrics.test(q)) return 'metrics';
  return 'general';
}

export function toRoutingIntent(
  toolIntentCategory: QueryRoutingToolIntentCategory,
  query: string,
  hasAttachment: boolean
): QueryRoutingSignals['intent'] {
  if (hasAttachment && ATTACHMENT_VISION_PATTERN.test(query)) return 'vision';
  if (FORCE_KB_QUERY_PATTERN.test(query)) return 'knowledge';
  if (isRestartNeededLookupQuery(query)) return 'metrics';
  if (!isFormattingOnlyReportRequest(query) && REPORTER_QUERY_PATTERN.test(query)) {
    return 'report';
  }
  if (toolIntentCategory === 'math') return 'metrics';
  return toolIntentCategory;
}

export function detectMetric(query: string): QueryRoutingMetric | undefined {
  if (/load\s*1|load1|부하/i.test(query)) return 'load1';
  if (/cpu|씨피유/i.test(query)) return 'cpu';
  if (/메모리|memory|memori|memroy|mem/i.test(query)) return 'memory';
  if (/디스크|disk|storage|스토리지/i.test(query)) return 'disk';
  if (/네트워크|network|traffic|latency|대역폭/i.test(query)) return 'network';
  return undefined;
}

export function detectTimeWindow(
  query: string
): QueryRoutingTimeWindow | undefined {
  if (/24\s*시간|24h|last\s*24h|지난\s*24/i.test(query)) return '24h';
  if (/최근|지난|last|평균|최대|최소|추이|트렌드/i.test(query)) return 'recent';
  if (/현재|지금|실시간|current|now|realtime/i.test(query)) return 'realtime';
  return undefined;
}

export function detectScope(query: string): QueryRoutingScope {
  if (WHOLE_FLEET_PATTERN.test(query)) return 'whole_fleet';
  if (SERVER_ID_PATTERN.test(query)) return 'single_server';
  if (SERVER_GROUP_PATTERN.test(query)) return 'server_group';
  return 'unknown';
}

export function deriveModeHint(
  query: string
): Exclude<SupervisorMode, 'auto'> {
  const q = query.toLowerCase();
  if (isFormattingOnlyReportRequest(q)) return 'single';
  if (isRestartNeededLookupQuery(q)) return 'single';
  if (FORCE_KB_QUERY_PATTERN.test(q)) return 'multi';
  if (CAPACITY_FULL_FORECAST_PATTERN.test(q)) return 'multi';
  return [REPORTER_QUERY_PATTERN, ADVISOR_QUERY_PATTERN].some((p) => p.test(q))
    ? 'multi'
    : 'single';
}

export function buildModeReasonCodes(
  query: string,
  modeHint: Exclude<SupervisorMode, 'auto'>
): string[] {
  if (isFormattingOnlyReportRequest(query)) return ['mode_single_formatting_only'];
  if (modeHint === 'single') return ['mode_single_default'];
  if (isRestartNeededLookupQuery(query)) return ['mode_single_default'];
  if (FORCE_KB_QUERY_PATTERN.test(query)) return ['mode_multi_knowledge'];
  if (CAPACITY_FULL_FORECAST_PATTERN.test(query)) return ['mode_multi_capacity_forecast'];
  if (REPORTER_QUERY_PATTERN.test(query)) return ['mode_multi_report_request'];
  if (ADVISOR_QUERY_PATTERN.test(query)) return ['mode_multi_advisor'];
  return ['mode_multi_default'];
}

export function isActionRequest(query: string): boolean {
  return ACTION_PATTERN.test(query);
}

export function isMutatingCommandRequest(query: string): boolean {
  return MUTATING_COMMAND_PATTERN.test(query);
}
