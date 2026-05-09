import type { RouteDecision } from '@/lib/ai/route-decision';
import { buildRouteDecision } from '@/lib/ai/route-decision';
import {
  analyzeQueryComplexity,
  type ComplexityAnalysis,
  shouldForceJobQueue,
} from '@/lib/ai/utils/query-complexity';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type { JobDataSlot } from '@/types/ai-jobs';

export type FrontendQueryMode = 'streaming' | 'job-queue';

export interface FrontendQueryRoutingInput {
  query: string;
  complexityThreshold: number;
  analysisMode?: AnalysisMode;
  hasAttachments?: boolean;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface FrontendQueryRoutingDecision {
  analysis: ComplexityAnalysis;
  forceJobQueue: ReturnType<typeof shouldForceJobQueue>;
  modeAdjustedThreshold: number;
  hasAttachments: boolean;
  queryMode: FrontendQueryMode;
  routeDecision: RouteDecision;
}

export interface AnalysisModeRoutingDeltaRow {
  query: string;
  score: number;
  complexity: ComplexityAnalysis['level'];
  autoThreshold: number;
  thinkingThreshold: number;
  autoMode: FrontendQueryMode;
  thinkingMode: FrontendQueryMode;
  changed: boolean;
}

export interface AnalysisModeRoutingDeltaSummary {
  total: number;
  changed: number;
  unchanged: number;
  autoJobCount: number;
  thinkingJobCount: number;
  streamToJob: number;
  jobToStream: number;
}

export function getAnalysisModeAdjustedThreshold(
  complexityThreshold: number,
  analysisMode?: AnalysisMode
): number {
  return analysisMode === 'thinking'
    ? Math.max(8, complexityThreshold - 8)
    : complexityThreshold;
}

export function buildFrontendQueryRoutingDecision({
  query,
  complexityThreshold,
  analysisMode,
  hasAttachments = false,
  queryAsOfDataSlot,
}: FrontendQueryRoutingInput): FrontendQueryRoutingDecision {
  const analysis = analyzeQueryComplexity(query);
  const forceJobQueue = shouldForceJobQueue(query);
  const modeAdjustedThreshold = getAnalysisModeAdjustedThreshold(
    complexityThreshold,
    analysisMode
  );
  const shouldUseJobQueue =
    !hasAttachments &&
    (analysis.score > modeAdjustedThreshold || forceJobQueue.force);

  const routeDecision = buildRouteDecision({
    intent: shouldUseJobQueue ? 'job' : 'chat',
    executionPath: shouldUseJobQueue ? 'job' : 'stream',
    complexity: analysis.level,
    reasonCodes: shouldUseJobQueue
      ? [
          forceJobQueue.force
            ? 'force_job_queue_keyword'
            : 'complexity_threshold_exceeded',
        ]
      : [
          hasAttachments
            ? 'attachment_streaming'
            : 'complexity_below_threshold',
        ],
    decidedBy: 'frontend',
    ...(queryAsOfDataSlot?.timeLabel && {
      dataSlot: queryAsOfDataSlot.timeLabel,
    }),
  });

  return {
    analysis,
    forceJobQueue,
    modeAdjustedThreshold,
    hasAttachments,
    queryMode: shouldUseJobQueue ? 'job-queue' : 'streaming',
    routeDecision,
  };
}

export function measureAnalysisModeRoutingDelta(
  queries: readonly string[],
  options: {
    complexityThreshold: number;
    hasAttachments?: boolean;
  }
): {
  rows: AnalysisModeRoutingDeltaRow[];
  summary: AnalysisModeRoutingDeltaSummary;
} {
  const rows = queries.map((query) => {
    const auto = buildFrontendQueryRoutingDecision({
      query,
      complexityThreshold: options.complexityThreshold,
      analysisMode: 'auto',
      hasAttachments: options.hasAttachments,
    });
    const thinking = buildFrontendQueryRoutingDecision({
      query,
      complexityThreshold: options.complexityThreshold,
      analysisMode: 'thinking',
      hasAttachments: options.hasAttachments,
    });

    return {
      query,
      score: auto.analysis.score,
      complexity: auto.analysis.level,
      autoThreshold: auto.modeAdjustedThreshold,
      thinkingThreshold: thinking.modeAdjustedThreshold,
      autoMode: auto.queryMode,
      thinkingMode: thinking.queryMode,
      changed: auto.queryMode !== thinking.queryMode,
    };
  });

  const autoJobCount = rows.filter(
    (row) => row.autoMode === 'job-queue'
  ).length;
  const thinkingJobCount = rows.filter(
    (row) => row.thinkingMode === 'job-queue'
  ).length;
  const streamToJob = rows.filter(
    (row) => row.autoMode === 'streaming' && row.thinkingMode === 'job-queue'
  ).length;
  const jobToStream = rows.filter(
    (row) => row.autoMode === 'job-queue' && row.thinkingMode === 'streaming'
  ).length;

  return {
    rows,
    summary: {
      total: rows.length,
      changed: rows.filter((row) => row.changed).length,
      unchanged: rows.filter((row) => !row.changed).length,
      autoJobCount,
      thinkingJobCount,
      streamToJob,
      jobToStream,
    },
  };
}
