import type { UIMessage } from 'ai';
import type { StructuredAssistantResponse } from '@/lib/ai/utils/assistant-response-view';
import {
  getToolDescription,
  getToolLabel,
} from '@/lib/ai/utils/tool-presentation';
import type {
  ProviderAttemptTelemetry,
  ResponseHandoff,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type {
  AnalysisFeatureStatus,
  RetrievalMetadata,
} from '@/types/ai/retrieval-status';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';

export type RagSource = {
  title: string;
  similarity: number;
  sourceType: string;
  category?: string;
  url?: string;
};

export type MessageMetadata = {
  traceId?: string;
  ragSources?: RagSource[];
  retrieval?: RetrievalMetadata;
  featureStatus?: AnalysisFeatureStatus;
  enableRAG?: boolean;
  enableWebSearch?: boolean | 'auto';
  toolsCalled?: string[];
  analysisMode?: AnalysisMode;
  processingTime?: number;
  latencyTier?: 'fast' | 'normal' | 'slow' | 'very_slow';
  resolvedMode?: 'single' | 'multi';
  modeSelectionSource?: string;
  provider?: string;
  modelId?: string;
  providerAttempts?: ProviderAttemptTelemetry[];
  usedFallback?: boolean;
  fallbackReason?: string;
  ttfbMs?: number;
  assistantResponseView?: StructuredAssistantResponse;
  handoffHistory?: ResponseHandoff[];
  toolResultSummaries?: ToolResultSummary[];
};

export type DeferredToolResult = {
  toolName: string;
  result: unknown;
};

type UIMessagePart = NonNullable<UIMessage['parts']>[number];

export type ToolPartWithCallId = UIMessagePart & {
  type: `tool-${string}`;
  toolCallId: string;
  output?: unknown;
  result?: unknown;
  state?: string;
  errorText?: string;
};

type ServerMetricsDataSlot = {
  slotIndex: number;
  minuteOfDay: number;
  timeLabel: string;
};

type ServerMetricsDataSource = {
  scopeName: string;
  scopeVersion: string;
  catalogGeneratedAt: string;
  hour: number;
};

type ServerMetricsParityMetadata = {
  dataSlot: ServerMetricsDataSlot;
  dataSource: ServerMetricsDataSource;
};

const LEGACY_PARITY_PATTERNS = [
  /getServerMetrics의 원본 데이터 필드/i,
  /_dataSlot/i,
  /_dataSource/i,
  /YYYYMMDD_HHMM/i,
  /메트릭 수집 소스/i,
  /전체 응답의 기준 시간 슬롯/i,
];

const SERVER_ANALYSIS_TOOL_NAMES = new Set([
  'getServerMetrics',
  'getServerMetricsAdvanced',
  'getServerByGroup',
  'getServerByGroupAdvanced',
  'filterServers',
  'getServerLogs',
  'detectAnomalies',
  'detectAnomaliesAllServers',
  'predictTrends',
  'analyzePattern',
  'correlateMetrics',
  'findRootCause',
  'buildIncidentTimeline',
]);

export function getMessageMetadata(
  message: UIMessage
): MessageMetadata | undefined {
  if (
    'metadata' in message &&
    message.metadata != null &&
    typeof message.metadata === 'object'
  ) {
    return message.metadata as MessageMetadata;
  }
  return undefined;
}

export function normalizeToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (toolName): toolName is string =>
      typeof toolName === 'string' && toolName.trim().length > 0
  );
}

export function dedupeToolNames(toolNames: string[]): string[] {
  return [...new Set(toolNames)];
}

function normalizePreviewForDetection(preview: string | undefined): string {
  return preview?.replace(/\s+/g, '') ?? '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCurrentMetricRankingOutput(output: unknown): boolean {
  if (!isRecord(output)) return false;

  if (output.responseKind === 'current_metric_ranking') {
    return true;
  }

  const query = output.query;
  if (!isRecord(query)) return false;

  return (
    query.timeRange === 'current' &&
    query.aggregation === 'none' &&
    typeof query.sortBy === 'string' &&
    typeof query.limit === 'number' &&
    query.limit > 0
  );
}

function isCurrentMetricRankingSummary(
  summary: ToolResultSummary | undefined
): boolean {
  if (!summary || summary.toolName !== 'getServerMetricsAdvanced') {
    return false;
  }

  const preview = normalizePreviewForDetection(summary.preview);
  return (
    preview.includes('"responseKind":"current_metric_ranking"') ||
    (preview.includes('"timeRange":"current"') &&
      preview.includes('"aggregation":"none"') &&
      preview.includes('"sortBy":"') &&
      preview.includes('"limit":'))
  );
}

export function shouldPrioritizeMetricRankingPresentation(params: {
  toolParts: ToolPartWithCallId[];
  metadataToolResultSummaries?: ToolResultSummary[];
}): boolean {
  if (
    params.toolParts.some(
      (part) =>
        part.type === 'tool-getServerMetricsAdvanced' &&
        isCurrentMetricRankingOutput(extractToolOutput(part))
    )
  ) {
    return true;
  }

  return (params.metadataToolResultSummaries ?? []).some(
    isCurrentMetricRankingSummary
  );
}

function getMetricRankingToolPriority(toolName: string): number {
  if (toolName === 'getServerMetricsAdvanced') return 0;
  if (toolName === 'filterServers') return 1;
  return 2;
}

export function reorderToolNamesForDisplay(
  toolNames: string[],
  prioritizeMetricRanking: boolean
): string[] {
  if (!prioritizeMetricRanking) {
    return toolNames;
  }

  return [...toolNames].sort(
    (left, right) =>
      getMetricRankingToolPriority(left) - getMetricRankingToolPriority(right)
  );
}

export function reorderToolPartsForDisplay(
  toolParts: ToolPartWithCallId[],
  prioritizeMetricRanking: boolean
): ToolPartWithCallId[] {
  if (!prioritizeMetricRanking) {
    return toolParts;
  }

  return [...toolParts].sort(
    (left, right) =>
      getMetricRankingToolPriority(left.type.slice(5)) -
      getMetricRankingToolPriority(right.type.slice(5))
  );
}

export function reorderToolResultSummariesForDisplay(
  summaries: ToolResultSummary[],
  prioritizeMetricRanking: boolean
): ToolResultSummary[] {
  if (!prioritizeMetricRanking) {
    return summaries;
  }

  return [...summaries].sort(
    (left, right) =>
      getMetricRankingToolPriority(left.toolName) -
      getMetricRankingToolPriority(right.toolName)
  );
}

export function mergeMessageMetadata(
  base: MessageMetadata | undefined,
  deferred: Record<string, unknown> | undefined
): MessageMetadata | undefined {
  if (!base && !deferred) return undefined;
  return {
    ...(base ?? {}),
    ...(deferred ?? {}),
  } as MessageMetadata;
}

function isDataSlot(value: unknown): value is ServerMetricsDataSlot {
  return (
    isRecord(value) &&
    typeof value.slotIndex === 'number' &&
    typeof value.minuteOfDay === 'number' &&
    typeof value.timeLabel === 'string'
  );
}

function isDataSource(value: unknown): value is ServerMetricsDataSource {
  return (
    isRecord(value) &&
    typeof value.scopeName === 'string' &&
    typeof value.scopeVersion === 'string' &&
    typeof value.catalogGeneratedAt === 'string' &&
    typeof value.hour === 'number'
  );
}

export function isToolPartWithCallId(
  part: UIMessagePart | null | undefined
): part is ToolPartWithCallId {
  return (
    part != null &&
    typeof part.type === 'string' &&
    part.type.startsWith('tool-') &&
    'toolCallId' in part &&
    typeof part.toolCallId === 'string'
  );
}

export function extractToolOutput(toolPart: ToolPartWithCallId): unknown {
  return toolPart.output ?? toolPart.result;
}

export function getCompletedToolNames(
  toolParts: ToolPartWithCallId[]
): string[] {
  return toolParts
    .filter((part) => extractToolOutput(part) !== undefined)
    .map((part) => part.type.slice(5));
}

export function createThinkingStepsFromSummaries(
  summaries: ToolResultSummary[] | undefined
): AIThinkingStep[] {
  if (!summaries || summaries.length === 0) return [];

  return summaries.map((summary, index) => ({
    id: `summary-${summary.toolName}-${index}`,
    step: summary.toolName,
    title: getToolLabel(summary.toolName),
    status: summary.status === 'failed' ? 'failed' : 'completed',
    description: summary.summary,
    timestamp: new Date(),
  }));
}

export function createThinkingStepsFromToolNames(
  toolNames: string[] | undefined
): AIThinkingStep[] {
  if (!toolNames || toolNames.length === 0) return [];

  return toolNames.map((toolName, index) => ({
    id: `tool-name-${toolName}-${index}`,
    step: toolName,
    title: getToolLabel(toolName),
    status: 'completed',
    description:
      getToolDescription(toolName) ??
      `${getToolLabel(toolName)} 실행을 완료했습니다.`,
    timestamp: new Date(),
  }));
}

export function createDeferredToolParts(
  toolResults: DeferredToolResult[] | undefined
): ToolPartWithCallId[] {
  if (!toolResults || toolResults.length === 0) return [];

  return toolResults.map((entry, index) => ({
    type: `tool-${entry.toolName}` as `tool-${string}`,
    toolCallId: `stream-tool-${entry.toolName}-${index}`,
    input: undefined,
    output: entry.result,
    state: 'output-available',
  }));
}

function truncatePreview(value: string, maxLength = 260): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatUnknownPreview(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return truncatePreview(value);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  try {
    return truncatePreview(JSON.stringify(value, null, 2));
  } catch {
    return undefined;
  }
}

function extractSummaryFromToolResult(
  toolName: string,
  output: unknown
): string | null {
  if (isRecord(output)) {
    if (typeof output.message === 'string' && output.message.trim()) {
      return output.message.trim();
    }
    if (typeof output.summary === 'string' && output.summary.trim()) {
      return output.summary.trim();
    }
    if (typeof output.answer === 'string' && output.answer.trim()) {
      return truncatePreview(output.answer.trim(), 140);
    }
    if (isDataSlot(output.dataSlot)) {
      return `${output.dataSlot.timeLabel} 기준 데이터를 확인했습니다.`;
    }
    if (Array.isArray(output.results)) {
      return `${output.results.length}개 결과를 반환했습니다.`;
    }
    if (Array.isArray(output.items)) {
      return `${output.items.length}개 항목을 조회했습니다.`;
    }
    if (typeof output.count === 'number') {
      return `${output.count}개 항목을 처리했습니다.`;
    }
    if (output.success === false) {
      const reason =
        typeof output.error === 'string'
          ? output.error
          : typeof output.reason === 'string'
            ? output.reason
            : '도구 실행이 실패했습니다.';
      return reason;
    }
  }

  if (Array.isArray(output)) {
    return `${output.length}개 항목을 반환했습니다.`;
  }
  if (typeof output === 'string' && output.trim()) {
    return truncatePreview(output.trim(), 140);
  }

  return `${getToolLabel(toolName)} 실행을 완료했습니다.`;
}

export function buildToolResultSummary(
  toolPart: ToolPartWithCallId
): ToolResultSummary | null {
  const toolName = toolPart.type.slice(5);
  const output = extractToolOutput(toolPart);
  const hasError = toolPart.state === 'output-error';

  if (output === undefined && !hasError) return null;

  const preview = formatUnknownPreview(output);
  const summary = hasError
    ? toolPart.errorText || `${getToolLabel(toolName)} 실행이 실패했습니다.`
    : extractSummaryFromToolResult(toolName, output);

  if (!summary) return null;

  return {
    toolName,
    label: getToolLabel(toolName),
    summary,
    preview,
    status: hasError ? 'failed' : 'completed',
  };
}

function extractServerMetricsParityMetadata(
  toolParts: ToolPartWithCallId[]
): ServerMetricsParityMetadata | null {
  const metricsToolPart = [...toolParts]
    .reverse()
    .find((part) => part.type === 'tool-getServerMetrics');

  if (!metricsToolPart) return null;

  const output = extractToolOutput(metricsToolPart);
  if (!isRecord(output)) return null;
  if (!isDataSlot(output.dataSlot) || !isDataSource(output.dataSource)) {
    return null;
  }

  return {
    dataSlot: output.dataSlot,
    dataSource: output.dataSource,
  };
}

function stripLegacyParityDetails(
  details: string | null | undefined
): string | null {
  if (typeof details !== 'string' || !details.trim()) return null;

  const filteredParagraphs = details
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter(
      (paragraph) =>
        !LEGACY_PARITY_PATTERNS.some((pattern) => pattern.test(paragraph))
    );

  const normalized = filteredParagraphs.join('\n\n').trim();
  return normalized.length > 0 ? normalized : null;
}

function formatParityMetadataDetails(
  parity: ServerMetricsParityMetadata
): string {
  return [
    '### Parity Metadata Contract',
    '```json',
    JSON.stringify(
      {
        dataSlot: parity.dataSlot,
        dataSource: parity.dataSource,
      },
      null,
      2
    ),
    '```',
  ].join('\n');
}

export function buildParityAwareAssistantResponseView(
  content: string,
  structured: StructuredAssistantResponse | undefined,
  toolParts: ToolPartWithCallId[]
): StructuredAssistantResponse | undefined {
  const parity = extractServerMetricsParityMetadata(toolParts);
  if (!parity) return structured;

  const normalizedParityDetails = formatParityMetadataDetails(parity);

  if (!structured) {
    return {
      summary: content.trim(),
      details: normalizedParityDetails,
      shouldCollapse: false,
    };
  }

  const sanitizedExistingDetails = stripLegacyParityDetails(structured.details);
  const details = sanitizedExistingDetails
    ? `${sanitizedExistingDetails}\n\n${normalizedParityDetails}`
    : normalizedParityDetails;

  return {
    ...structured,
    details,
    shouldCollapse: true,
  };
}

export function isServerAnalysisToolName(toolName: string): boolean {
  return SERVER_ANALYSIS_TOOL_NAMES.has(toolName);
}
