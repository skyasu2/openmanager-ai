import {
  analyzeLargeLog,
  analyzePattern,
  analyzeScreenshot,
  analyzeUrlContent,
  buildIncidentTimeline,
  computeSeriesStats,
  correlateMetrics,
  detectAnomalies,
  detectAnomaliesAllServers,
  enhanceSuggestedActions,
  estimateCapacityProjection,
  evaluateIncidentReport,
  evaluateMathExpression,
  filterServers,
  finalAnswer,
  findRootCause,
  getServerByGroup,
  getServerByGroupAdvanced,
  getServerLogs,
  getServerMetrics,
  getServerMetricsAdvanced,
  predictTrends,
  recommendCommands,
  refineRootCauseAnalysis,
  scoreRootCauseConfidence,
  searchKnowledgeBase,
  searchWeb,
  searchWithGrounding,
  extendServerCorrelation,
  validateReportStructure,
} from '../../tools-ai-sdk';
import type { ToolDefinition } from '../../core/assistant-runtime';
import type { AgentToolName } from '../../services/ai-sdk/agents/config/agent-runtime-policy';

type RuntimeToolDefinition = {
  description?: string;
  inputSchema?: unknown;
  execute?: unknown;
};

function defineMonitoringTool(
  name: AgentToolName,
  tool: RuntimeToolDefinition
): ToolDefinition {
  const execute =
    typeof tool.execute === 'function'
      ? (tool.execute as (input: unknown) => unknown | Promise<unknown>)
      : undefined;

  return {
    name,
    description: tool.description ?? name,
    ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
    ...(execute === undefined
      ? {}
      : { execute: (input: unknown) => execute(input) }),
  };
}

export const MONITORING_AGENT_TOOL_REGISTRY: Record<
  AgentToolName,
  ToolDefinition
> = {
  getServerMetrics: defineMonitoringTool('getServerMetrics', getServerMetrics),
  getServerMetricsAdvanced: defineMonitoringTool(
    'getServerMetricsAdvanced',
    getServerMetricsAdvanced
  ),
  filterServers: defineMonitoringTool('filterServers', filterServers),
  getServerByGroup: defineMonitoringTool('getServerByGroup', getServerByGroup),
  getServerByGroupAdvanced: defineMonitoringTool(
    'getServerByGroupAdvanced',
    getServerByGroupAdvanced
  ),
  getServerLogs: defineMonitoringTool('getServerLogs', getServerLogs),
  detectAnomalies: defineMonitoringTool('detectAnomalies', detectAnomalies),
  detectAnomaliesAllServers: defineMonitoringTool(
    'detectAnomaliesAllServers',
    detectAnomaliesAllServers
  ),
  predictTrends: defineMonitoringTool('predictTrends', predictTrends),
  analyzePattern: defineMonitoringTool('analyzePattern', analyzePattern),
  correlateMetrics: defineMonitoringTool('correlateMetrics', correlateMetrics),
  findRootCause: defineMonitoringTool('findRootCause', findRootCause),
  buildIncidentTimeline: defineMonitoringTool(
    'buildIncidentTimeline',
    buildIncidentTimeline
  ),
  searchKnowledgeBase: defineMonitoringTool(
    'searchKnowledgeBase',
    searchKnowledgeBase
  ),
  recommendCommands: defineMonitoringTool('recommendCommands', recommendCommands),
  searchWeb: defineMonitoringTool('searchWeb', searchWeb),
  evaluateIncidentReport: defineMonitoringTool(
    'evaluateIncidentReport',
    evaluateIncidentReport
  ),
  validateReportStructure: defineMonitoringTool(
    'validateReportStructure',
    validateReportStructure
  ),
  scoreRootCauseConfidence: defineMonitoringTool(
    'scoreRootCauseConfidence',
    scoreRootCauseConfidence
  ),
  refineRootCauseAnalysis: defineMonitoringTool(
    'refineRootCauseAnalysis',
    refineRootCauseAnalysis
  ),
  enhanceSuggestedActions: defineMonitoringTool(
    'enhanceSuggestedActions',
    enhanceSuggestedActions
  ),
  extendServerCorrelation: defineMonitoringTool(
    'extendServerCorrelation',
    extendServerCorrelation
  ),
  finalAnswer: defineMonitoringTool('finalAnswer', finalAnswer),
  analyzeScreenshot: defineMonitoringTool('analyzeScreenshot', analyzeScreenshot),
  analyzeLargeLog: defineMonitoringTool('analyzeLargeLog', analyzeLargeLog),
  searchWithGrounding: defineMonitoringTool(
    'searchWithGrounding',
    searchWithGrounding
  ),
  analyzeUrlContent: defineMonitoringTool('analyzeUrlContent', analyzeUrlContent),
  evaluateMathExpression: defineMonitoringTool(
    'evaluateMathExpression',
    evaluateMathExpression
  ),
  computeSeriesStats: defineMonitoringTool('computeSeriesStats', computeSeriesStats),
  estimateCapacityProjection: defineMonitoringTool(
    'estimateCapacityProjection',
    estimateCapacityProjection
  ),
};
