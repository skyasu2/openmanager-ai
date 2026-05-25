import type { SemanticQueryTrace } from '@/lib/ai/semantic-intent-frame';
import {
  buildAnalysisFeatureStatus,
  normalizeEvidenceCards,
  normalizeRetrievalMetadata,
} from '@/lib/ai/utils/retrieval-status';
import type {
  AnalysisBasis,
  AnalysisBasisSourceGroup,
  ToolResultSummary,
} from '@/stores/useAISidebarStore';
import type { EvidenceCard } from '@/types/ai/retrieval-status';
import type {
  MessageMetadata,
  RagSource,
  ToolPartWithCallId,
} from './message-transform-internals';
import {
  dedupeToolNames,
  extractToolOutput,
  getCompletedToolNames,
  isServerAnalysisToolName,
  normalizeToolNames,
  reorderToolNamesForDisplay,
} from './message-transform-internals';

const SOURCE_TOOL_NAMES = new Set([
  'finalAnswer',
  'searchKnowledgeBase',
  'searchWeb',
]);

export function findRetrievalMetadataFromToolParts(
  toolParts: ToolPartWithCallId[]
) {
  for (const toolPart of toolParts) {
    if (toolPart.type !== 'tool-searchKnowledgeBase') continue;
    const output = extractToolOutput(toolPart);
    if (!output || typeof output !== 'object') continue;
    const retrieval = normalizeRetrievalMetadata(
      (output as Record<string, unknown>).retrieval
    );
    if (retrieval) return retrieval;
  }
  return undefined;
}

export function findEvidenceCardsFromToolParts(
  toolParts: ToolPartWithCallId[]
): EvidenceCard[] {
  const evidenceCards: EvidenceCard[] = [];
  for (const toolPart of toolParts) {
    if (toolPart.type !== 'tool-searchKnowledgeBase') continue;
    const output = extractToolOutput(toolPart);
    if (!output || typeof output !== 'object') continue;
    evidenceCards.push(
      ...normalizeEvidenceCards(
        (output as Record<string, unknown>).evidenceCards
      )
    );
  }
  return evidenceCards;
}

export function buildAnalysisSourceGroups(params: {
  semanticQueryTrace?: SemanticQueryTrace;
  hasServerAnalysisEvidence: boolean;
  knowledgeEvidenceCount: number;
  legacyKnowledgeSourceCount: number;
  webEvidenceCount: number;
  legacyWebSourceCount: number;
  retrievalEvidenceCount: number;
  retrievalIndicatesKnowledgeUse: boolean;
  retrievalIndicatesWebUse: boolean;
  toolResultSummaries: ToolResultSummary[];
  completedToolNames: string[];
}): AnalysisBasisSourceGroup[] {
  const groups: AnalysisBasisSourceGroup[] = [];

  const addGroup = (
    type: AnalysisBasisSourceGroup['type'],
    label: string,
    count: number,
    detail?: string
  ) => {
    if (count <= 0) return;
    groups.push({
      type,
      label,
      count,
      ...(detail ? { detail } : {}),
    });
  };

  const semanticProvider = params.semanticQueryTrace?.selectedEvidenceProvider;
  const hasDomainEvidence =
    params.semanticQueryTrace?.evidenceAvailable === true ||
    Boolean(semanticProvider);
  addGroup(
    'monitoring-data',
    'monitoring-data',
    hasDomainEvidence || params.hasServerAnalysisEvidence ? 1 : 0,
    semanticProvider ??
      (params.hasServerAnalysisEvidence ? 'server metrics' : undefined)
  );

  const knowledgeCount =
    params.knowledgeEvidenceCount ||
    params.legacyKnowledgeSourceCount ||
    (params.retrievalIndicatesKnowledgeUse ? params.retrievalEvidenceCount : 0);
  addGroup('knowledge-base', 'knowledge-base', knowledgeCount);

  const webCount =
    params.webEvidenceCount ||
    params.legacyWebSourceCount ||
    (params.retrievalIndicatesWebUse
      ? Math.max(1, params.retrievalEvidenceCount)
      : 0);
  addGroup('web-search', 'web-search', webCount);

  const summarizedToolCount = params.toolResultSummaries.filter(
    (summary) => !SOURCE_TOOL_NAMES.has(summary.toolName)
  ).length;
  const completedToolCount = params.completedToolNames.filter(
    (toolName) => !SOURCE_TOOL_NAMES.has(toolName)
  ).length;
  addGroup(
    'tool-result',
    'tool-result',
    summarizedToolCount || completedToolCount
  );

  return groups;
}

export function getSemanticEvidenceDataSource(
  semanticQueryTrace: SemanticQueryTrace | undefined
): string | undefined {
  if (!semanticQueryTrace?.evidenceAvailable) return undefined;

  if (semanticQueryTrace.selectedCapability === 'monitoring.metric_peak') {
    return '모니터링 피크 지표 근거';
  }

  if (semanticQueryTrace.selectedDomain === 'openmanager-monitoring') {
    return '모니터링 도메인 근거';
  }

  return '도메인 근거 기반 응답';
}

export function buildAssistantAnalysisBasis(params: {
  metadata?: MessageMetadata;
  toolParts: ToolPartWithCallId[];
  toolResultSummaries: ToolResultSummary[];
  prioritizeMetricRankingPresentation: boolean;
  currentMode?: 'streaming' | 'job-queue';
  isLastMessage: boolean;
  streamRagSources?: RagSource[];
  ragEnabled?: boolean;
  webSearchEnabled?: boolean;
  semanticQueryTrace?: SemanticQueryTrace;
}): AnalysisBasis {
  const {
    metadata,
    toolParts,
    toolResultSummaries,
    prioritizeMetricRankingPresentation,
    currentMode,
    isLastMessage,
    streamRagSources,
    ragEnabled,
    webSearchEnabled,
    semanticQueryTrace,
  } = params;
  const isJobQueue = currentMode === 'job-queue';

  const metadataToolNames = reorderToolNamesForDisplay(
    normalizeToolNames(metadata?.toolsCalled),
    prioritizeMetricRankingPresentation
  );
  const calledToolNames = dedupeToolNames([
    ...metadataToolNames,
    ...toolParts.map((part) => part.type.slice(5)),
  ]);
  const completedToolNames = dedupeToolNames([
    ...metadataToolNames,
    ...getCompletedToolNames(toolParts),
  ]);
  const hasServerAnalysisEvidence = completedToolNames.some(
    isServerAnalysisToolName
  );
  const hasAdvisorCommandEvidence =
    completedToolNames.includes('recommendCommands') ||
    toolResultSummaries.some(
      (summary) => summary.toolName === 'recommendCommands'
    );

  const metadataEvidenceCards = normalizeEvidenceCards(metadata?.evidenceCards);
  const evidenceCards =
    metadataEvidenceCards.length > 0
      ? metadataEvidenceCards
      : findEvidenceCardsFromToolParts(toolParts);
  const hasEvidenceCards = evidenceCards.length > 0;
  const knowledgeEvidenceCount = evidenceCards.filter(
    (card) => card.sourceType !== 'web'
  ).length;
  const webEvidenceCount = evidenceCards.filter(
    (card) => card.sourceType === 'web'
  ).length;

  const ragSources =
    metadata?.ragSources ?? (isLastMessage ? streamRagSources : undefined);
  const hasRag = ragSources && ragSources.length > 0;
  const webSources =
    ragSources?.filter((source) => source.sourceType === 'web') ?? [];
  const legacyKnowledgeSourceCount =
    ragSources?.filter((source) => source.sourceType !== 'web').length ?? 0;
  const legacyWebSourceCount = webSources.length;
  const hasWebSearch = webEvidenceCount > 0 || legacyWebSourceCount > 0;
  const hasKnowledgeSearch = Boolean(
    knowledgeEvidenceCount > 0 || legacyKnowledgeSourceCount > 0
  );
  const retrieval =
    normalizeRetrievalMetadata(metadata?.retrieval) ??
    findRetrievalMetadataFromToolParts(toolParts);
  const effectiveRagEnabled =
    typeof metadata?.enableRAG === 'boolean' ? metadata.enableRAG : ragEnabled;
  const effectiveWebSearchEnabled =
    metadata?.enableWebSearch !== undefined
      ? metadata.enableWebSearch
      : webSearchEnabled;
  const featureStatus =
    metadata?.featureStatus ??
    buildAnalysisFeatureStatus({
      retrieval,
      ragEnabled: effectiveRagEnabled,
      webSearchEnabled: effectiveWebSearchEnabled,
      hasKnowledgeEvidence: hasKnowledgeSearch,
      hasWebEvidence: hasWebSearch,
    });
  const retrievalIndicatesKnowledgeUse = Boolean(retrieval?.retrievalUsed);
  const retrievalIndicatesWebUse = Boolean(retrieval?.webUsed);
  const semanticEvidenceDataSource =
    getSemanticEvidenceDataSource(semanticQueryTrace);
  const sourceGroups = buildAnalysisSourceGroups({
    semanticQueryTrace,
    hasServerAnalysisEvidence,
    knowledgeEvidenceCount,
    legacyKnowledgeSourceCount,
    webEvidenceCount,
    legacyWebSourceCount,
    retrievalEvidenceCount: retrieval?.evidenceCount ?? 0,
    retrievalIndicatesKnowledgeUse,
    retrievalIndicatesWebUse,
    toolResultSummaries,
    completedToolNames,
  });

  let dataSource: string;
  if (webEvidenceCount > 0) {
    dataSource = `웹 검색 (${webEvidenceCount}건)`;
  } else if (hasWebSearch) {
    dataSource = `웹 검색 (${webSources.length}건)`;
  } else if (knowledgeEvidenceCount > 0) {
    dataSource = `지식 근거 검색 (${knowledgeEvidenceCount}건)`;
  } else if (hasRag) {
    dataSource = `지식 근거 검색 (${ragSources.length}건)`;
  } else if (retrievalIndicatesKnowledgeUse) {
    dataSource = `지식 근거 검색 (${retrieval?.evidenceCount ?? 0}건)`;
  } else if (semanticEvidenceDataSource) {
    dataSource = semanticEvidenceDataSource;
  } else if (hasAdvisorCommandEvidence) {
    dataSource = 'Advisor Agent 조치 명령어 근거';
  } else if (hasServerAnalysisEvidence) {
    dataSource = '서버 실시간 데이터 분석';
  } else if (effectiveRagEnabled) {
    dataSource = '일반 대화 응답 (지식 검색 활성)';
  } else {
    dataSource = '일반 대화 응답';
  }

  return {
    dataSource,
    engine: isJobQueue ? 'Cloud Run AI' : 'Streaming AI',
    ragUsed: hasKnowledgeSearch || retrievalIndicatesKnowledgeUse,
    toolsCalled: calledToolNames.length > 0 ? calledToolNames : undefined,
    timeRange: hasServerAnalysisEvidence ? '최근 1시간' : undefined,
    evidenceCards: hasEvidenceCards ? evidenceCards : undefined,
    ragSources: hasRag ? ragSources : undefined,
    ...(retrieval && { retrieval }),
    featureStatus,
    sourceGroups: sourceGroups.length > 0 ? sourceGroups : undefined,
  };
}
