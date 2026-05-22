import type { RouteDecision } from '@/lib/ai/route-decision';
import { buildRouteDecision } from '@/lib/ai/route-decision';
import {
  analyzeQueryComplexity,
  type ComplexityAnalysis,
  shouldForceJobQueue,
} from '@/lib/ai/utils/query-complexity';
import type { JobDataSlot } from '@/types/ai-jobs';

export type FrontendQueryMode = 'streaming' | 'job-queue';

export interface FrontendQueryRoutingInput {
  query: string;
  complexityThreshold: number;
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

export function buildFrontendQueryRoutingDecision({
  query,
  complexityThreshold,
  hasAttachments = false,
  queryAsOfDataSlot,
}: FrontendQueryRoutingInput): FrontendQueryRoutingDecision {
  const analysis = analyzeQueryComplexity(query);
  const forceJobQueue = shouldForceJobQueue(query);
  const modeAdjustedThreshold = complexityThreshold;
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
