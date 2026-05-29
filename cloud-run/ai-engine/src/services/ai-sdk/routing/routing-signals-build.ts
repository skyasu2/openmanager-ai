import {
  INVERSE_STATUS_PATTERN,
  MIN_METRIC_PATTERN,
  isRestartNeededLookupQuery,
} from './routing-patterns';
import {
  ADVISOR_QUERY_PATTERN,
  ANALYST_QUERY_PATTERN,
  ATTACHMENT_VISION_PATTERN,
  FORCE_KB_QUERY_PATTERN,
  GENERAL_PATTERNS,
  GREETING_PATTERNS,
  INFRA_CONTEXT_PATTERN,
  REPORTER_QUERY_PATTERN,
  SERVER_TOPIC_PATTERN,
} from './routing-keywords';
import {
  buildModeReasonCodes,
  deriveModeHint,
  detectMetric,
  detectScope,
  detectTimeWindow,
  detectToolIntentCategory,
  hasCompositeSignal,
  isActionRequest,
  isFormattingOnlyReportRequest,
  isMutatingCommandRequest,
  toRoutingIntent,
} from './routing-signals-classify';
import type {
  QueryRoutingPreFilterSignal,
  QueryRoutingSignalOptions,
  QueryRoutingSignals,
} from './routing-signals-types';

function appendUnique(reasonCodes: string[], code: string): void {
  if (!reasonCodes.includes(code)) reasonCodes.push(code);
}

function buildPreFilterSignal(
  query: string,
  options: QueryRoutingSignalOptions
): QueryRoutingPreFilterSignal {
  const normalized = query.trim().toLowerCase();

  if (GREETING_PATTERNS.some((p) => p.test(query))) {
    return { action: 'direct_response', confidence: 0.95, reasonCodes: ['prefilter_greeting'] };
  }

  if (GENERAL_PATTERNS.some((p) => p.test(query))) {
    return { action: 'direct_response', confidence: 0.95, reasonCodes: ['prefilter_general'] };
  }

  const isForceKnowledgeBaseIntent = FORCE_KB_QUERY_PATTERN.test(query);
  const isRestartNeededLookupIntent = isRestartNeededLookupQuery(query);
  const hasServerKeyword =
    isForceKnowledgeBaseIntent ||
    isRestartNeededLookupIntent ||
    SERVER_TOPIC_PATTERN.test(normalized);
  const hasAttachmentVisionHint =
    (options.hasImageAttachments === true || options.hasFileAttachments === true) &&
    ATTACHMENT_VISION_PATTERN.test(normalized);

  if (hasAttachmentVisionHint) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Vision Agent',
      confidence: 0.92,
      reasonCodes: ['prefilter_vision_attachment'],
    };
  }

  if (!hasServerKeyword) {
    return { action: 'continue', confidence: 0.5, reasonCodes: ['prefilter_continue'] };
  }

  const isVisionIntent = ATTACHMENT_VISION_PATTERN.test(query) || hasAttachmentVisionHint;
  const isAnalystIntent = ANALYST_QUERY_PATTERN.test(query);
  const isReporterIntent = !isFormattingOnlyReportRequest(query) && REPORTER_QUERY_PATTERN.test(query);
  const isAdvisorIntent = isForceKnowledgeBaseIntent || ADVISOR_QUERY_PATTERN.test(query);
  const isInverseFilterIntent = INVERSE_STATUS_PATTERN.test(query);
  const isMinMetricRankingIntent = MIN_METRIC_PATTERN.test(query) && !isAnalystIntent;
  const isOpsProcedureIntent =
    /(스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|대응\s*(순서|절차))/i.test(
      query
    );

  if (isInverseFilterIntent || isMinMetricRankingIntent || isRestartNeededLookupIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.88,
      reasonCodes: ['prefilter_suggest_nlq'],
    };
  }

  if (isOpsProcedureIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Advisor Agent',
      confidence: 0.9,
      reasonCodes: ['prefilter_suggest_advisor'],
    };
  }

  const intentMatches = [isVisionIntent, isAnalystIntent, isReporterIntent, isAdvisorIntent].filter(Boolean).length;
  const likelyCompositeQuery =
    intentMatches >= 2 ||
    (hasCompositeSignal(query) && (intentMatches >= 1 || query.length >= 70));

  if (likelyCompositeQuery) {
    let suggestedAgent = 'Metrics Query Agent';
    let reasonCode = 'prefilter_suggest_nlq';
    if (isReporterIntent) { suggestedAgent = 'Reporter Agent'; reasonCode = 'prefilter_suggest_reporter'; }
    else if (isAnalystIntent) { suggestedAgent = 'Analyst Agent'; reasonCode = 'prefilter_suggest_analyst'; }
    else if (isAdvisorIntent) { suggestedAgent = 'Advisor Agent'; reasonCode = 'prefilter_suggest_advisor'; }
    return { action: 'suggest_agent', suggestedAgent, confidence: 0.68, reasonCodes: [reasonCode] };
  }

  if (isVisionIntent) {
    return { action: 'suggest_agent', suggestedAgent: 'Vision Agent', confidence: 0.92, reasonCodes: ['prefilter_vision_attachment'] };
  }
  if (isReporterIntent) {
    return { action: 'suggest_agent', suggestedAgent: 'Reporter Agent', confidence: 0.9, reasonCodes: ['prefilter_suggest_reporter'] };
  }
  if (isAnalystIntent) {
    return { action: 'suggest_agent', suggestedAgent: 'Analyst Agent', confidence: 0.88, reasonCodes: ['prefilter_suggest_analyst'] };
  }
  if (isAdvisorIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Advisor Agent',
      confidence: isForceKnowledgeBaseIntent ? 0.9 : 0.87,
      reasonCodes: ['prefilter_suggest_advisor'],
    };
  }

  return {
    action: 'suggest_agent',
    suggestedAgent: 'Metrics Query Agent',
    confidence: 0.86,
    reasonCodes: ['prefilter_suggest_nlq'],
  };
}

export function extractQueryRoutingSignals(
  query: string,
  options: QueryRoutingSignalOptions = {}
): QueryRoutingSignals {
  const normalizedQuery = query.toLowerCase().trim();
  const reasonCodes: string[] = [];
  const hasImageAttachment = options.hasImageAttachments === true;
  const hasFileAttachment = options.hasFileAttachments === true;
  const hasAttachment = hasImageAttachment || hasFileAttachment;
  const isRestartNeededLookupIntent = isRestartNeededLookupQuery(normalizedQuery);
  const hasInfraContext =
    INFRA_CONTEXT_PATTERN.test(normalizedQuery) || isRestartNeededLookupIntent;
  const asksForFormattingOnly = isFormattingOnlyReportRequest(normalizedQuery);
  const asksForReport = !asksForFormattingOnly && REPORTER_QUERY_PATTERN.test(normalizedQuery);
  const asksForAction = isActionRequest(normalizedQuery);
  const asksForMutation = isMutatingCommandRequest(normalizedQuery);
  const toolIntentCategory = detectToolIntentCategory(normalizedQuery);
  const intent = toRoutingIntent(toolIntentCategory, normalizedQuery, hasAttachment);
  const scope = detectScope(normalizedQuery);
  const metric = detectMetric(normalizedQuery);
  const timeWindow = detectTimeWindow(normalizedQuery);
  const modeHint = deriveModeHint(normalizedQuery);
  const preFilter = buildPreFilterSignal(query, options);

  if (hasInfraContext) appendUnique(reasonCodes, 'infra_context_present');
  if (isRestartNeededLookupIntent) appendUnique(reasonCodes, 'restart_needed_lookup');
  if (hasCompositeSignal(normalizedQuery)) appendUnique(reasonCodes, 'composite_query');
  if (metric) appendUnique(reasonCodes, `metric_detected_${metric}`);
  if (scope === 'whole_fleet' && metric) appendUnique(reasonCodes, 'whole_fleet_metric');
  if (scope === 'single_server') appendUnique(reasonCodes, 'single_server_id_match');
  if (hasImageAttachment) appendUnique(reasonCodes, 'attachment_image');
  if (hasFileAttachment) appendUnique(reasonCodes, 'attachment_file');
  if (asksForFormattingOnly) appendUnique(reasonCodes, 'formatting_only_report');
  if (asksForMutation) appendUnique(reasonCodes, 'mutating_command_request');
  if (toolIntentCategory === 'math') appendUnique(reasonCodes, 'math_expression');
  for (const code of buildModeReasonCodes(normalizedQuery, modeHint)) {
    appendUnique(reasonCodes, code);
  }

  return {
    intent,
    toolIntentCategory,
    scope,
    hasInfraContext,
    hasAttachment,
    hasImageAttachment,
    hasFileAttachment,
    asksForReport,
    asksForAction,
    asksForMutation,
    asksForFormattingOnly,
    ...(metric ? { metric } : {}),
    ...(timeWindow ? { timeWindow } : {}),
    confidence: preFilter.confidence,
    reasonCodes,
    modeHint,
    preFilter,
  };
}
