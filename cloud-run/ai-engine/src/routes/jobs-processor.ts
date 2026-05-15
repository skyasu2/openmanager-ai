import type {
  EvidenceCard,
  RetrievalMetadata,
} from '../lib/retrieval-contract';
import { getPublicErrorResponse } from '../lib/error-handler';
import { logger } from '../lib/logger';
import {
  storeJobError,
  storeJobResult,
  updateJobProgress,
} from '../lib/job-notifier';
import {
  executeSupervisorStream,
  logProviderStatus,
} from '../services/ai-sdk';
import { getDefaultMonitoringAssistantRuntimeHost } from '../services/ai-sdk/monitoring-runtime-host';
import {
  normalizeSemanticQueryTrace,
  type SemanticQueryTrace,
} from '../services/ai-sdk/supervisor-semantic-metadata';
import type {
  AnalysisMode,
  SupervisorRequest,
} from '../services/ai-sdk/supervisor-types';
import type { QueryAsOf } from '../data/query-as-of-context';
import {
  type JobErrorDetails,
  type JobStreamHandoff,
  STAGE_PROGRESS_MAP,
  appendExecutionPath,
  buildProgressMetadata,
  extractJobErrorDetails,
  getAgentLabel,
  getStringValue,
  isRecord,
  normalizeJobErrorDetails,
  parseAgentStatusEvent,
  parseHandoffEvent,
  resolveAgentStage,
} from './jobs-route-helpers';
import {
  extractProviderMetadata,
  type JobProviderMetadata,
  parseRetrievalMetadata,
} from './jobs-result-metadata';

export async function processJobSynchronously({
  jobId,
  messages,
  sessionId,
  analysisMode,
  enableRAG,
  enableWebSearch,
  internalDisclosureMode,
  localRouteDecision,
  metadata,
  queryAsOf,
  startTime,
}: {
  jobId: string;
  messages: Array<{ role: string; content: string }>;
  sessionId?: string;
  analysisMode?: AnalysisMode;
  enableRAG?: SupervisorRequest['enableRAG'];
  enableWebSearch?: SupervisorRequest['enableWebSearch'];
  internalDisclosureMode?: SupervisorRequest['internalDisclosureMode'];
  localRouteDecision?: SupervisorRequest['localRouteDecision'];
  metadata?: SupervisorRequest['metadata'];
  queryAsOf?: QueryAsOf;
  startTime: number;
}): Promise<{ status: 'completed' | 'failed'; error?: string }> {
  const startedAt = new Date().toISOString();

  try {
    await updateJobProgress(
      jobId,
      'routing',
      20,
      'Supervisor가 적절한 에이전트 선택 중...',
      buildProgressMetadata({
        executionPath: ['Orchestrator'],
        handoffs: [],
        agent: 'Orchestrator',
      })
    );

    logProviderStatus();

    await updateJobProgress(
      jobId,
      'processing',
      50,
      'AI 에이전트가 응답 생성 중...',
      buildProgressMetadata({
        executionPath: ['Orchestrator'],
        handoffs: [],
        agent: 'Orchestrator',
      })
    );

    const responseChunks: string[] = [];
    const executionPath: string[] = ['Orchestrator'];
    const handoffs: JobStreamHandoff[] = [];
    const toolsCalled: string[] = [];
    const toolResults: Array<{ toolName?: string; result?: unknown }> = [];
    let ragSources: Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
    }> = [];
    let evidenceCards: EvidenceCard[] = [];
    let finalAgent: string | undefined;
    let traceId: string | undefined;
    let retrieval: RetrievalMetadata | undefined;
    let routeDecision: unknown;
    let assistantPlan: unknown;
    let assistantResult: unknown;
    let semanticQueryTrace: SemanticQueryTrace | undefined;
    let providerMetadata: JobProviderMetadata = {};
    let toolResultSummaries:
      | Array<{
          toolName: string;
          label: string;
          summary: string;
          preview?: string;
          status: 'completed' | 'failed';
        }>
      | undefined;
    let completedSuccessfully = false;

    for await (const event of executeSupervisorStream({
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      sessionId: sessionId || 'default',
      analysisMode,
      enableRAG,
      enableWebSearch,
      internalDisclosureMode,
      localRouteDecision,
      metadata,
      queryAsOf,
      runtimeHost: getDefaultMonitoringAssistantRuntimeHost(),
    })) {
      if (event.type === 'text_delta' && typeof event.data === 'string') {
        responseChunks.push(event.data);
        continue;
      }

      if (event.type === 'tool_call' && isRecord(event.data)) {
        const toolName =
          getStringValue(event.data.name) ?? getStringValue(event.data.toolName);
        if (toolName) {
          toolsCalled.push(toolName);
        }
        continue;
      }

      if (event.type === 'tool_result' && isRecord(event.data)) {
        toolResults.push({
          ...(getStringValue(event.data.toolName) && {
            toolName: getStringValue(event.data.toolName),
          }),
          result: event.data.result,
        });
        continue;
      }

      if (event.type === 'agent_status') {
        const agentStatus = parseAgentStatusEvent(event.data);
        if (!agentStatus) continue;

        appendExecutionPath(executionPath, agentStatus.agent);
        const stage = resolveAgentStage(agentStatus.agent);
        await updateJobProgress(
          jobId,
          stage,
          STAGE_PROGRESS_MAP[stage] ?? 60,
          agentStatus.message ?? `${getAgentLabel(agentStatus.agent)} 처리 중...`,
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: agentStatus.agent,
          })
        );
        continue;
      }

      if (event.type === 'handoff') {
        const handoff = parseHandoffEvent(event.data);
        if (!handoff) continue;

        handoffs.push(handoff);
        appendExecutionPath(executionPath, handoff.from, handoff.to);
        const stage = resolveAgentStage(handoff.to);
        await updateJobProgress(
          jobId,
          stage,
          STAGE_PROGRESS_MAP[stage] ?? 60,
          `${getAgentLabel(handoff.to)}로 전달 중...`,
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: handoff.to,
            handoff,
          })
        );
        continue;
      }

      if (event.type === 'error') {
        const errorData = isRecord(event.data) ? event.data : {};
        const streamError = new Error(
          getStringValue(errorData.message) ??
            getStringValue(errorData.error) ??
            'Unknown error'
        );
        const errorDetails = normalizeJobErrorDetails(errorData);
        if (errorDetails?.kind === 'rate-limit') {
          (
            streamError as Error & {
              details?: JobErrorDetails;
            }
          ).details = errorDetails;
        }
        throw streamError;
      }

      if (event.type === 'done') {
        const doneData = isRecord(event.data) ? event.data : {};
        const metadata = isRecord(doneData.metadata) ? doneData.metadata : {};
        if (doneData.success === false) {
          const warning = isRecord(doneData.warning) ? doneData.warning : {};
          throw new Error(
            getStringValue(warning.message) ??
              'AI processing did not complete successfully'
          );
        }

        finalAgent =
          getStringValue(doneData.finalAgent) ??
          getStringValue(metadata.finalAgent) ??
          finalAgent;
        if (finalAgent) {
          appendExecutionPath(executionPath, finalAgent);
        }

        if (Array.isArray(metadata.handoffs)) {
          for (const item of metadata.handoffs) {
            const handoff = parseHandoffEvent(item);
            if (!handoff) continue;
            const exists = handoffs.some(
              (current) =>
                current.from === handoff.from &&
                current.to === handoff.to &&
                current.reason === handoff.reason
            );
            if (!exists) {
              handoffs.push(handoff);
            }
            appendExecutionPath(executionPath, handoff.from, handoff.to);
          }
        }

        if (Array.isArray(doneData.toolsCalled)) {
          toolsCalled.push(
            ...doneData.toolsCalled.filter(
              (tool): tool is string =>
                typeof tool === 'string' && tool.trim().length > 0
            )
          );
        }

        if (Array.isArray(doneData.ragSources)) {
          ragSources = doneData.ragSources as typeof ragSources;
        }
        if (Array.isArray(doneData.evidenceCards)) {
          evidenceCards = doneData.evidenceCards as EvidenceCard[];
        }

        traceId = getStringValue(metadata.traceId) ?? traceId;
        retrieval = parseRetrievalMetadata(metadata.retrieval) ?? retrieval;
        routeDecision = metadata.routeDecision ?? routeDecision;
        assistantPlan = metadata.assistantPlan ?? assistantPlan;
        assistantResult = metadata.assistantResult ?? assistantResult;
        semanticQueryTrace =
          normalizeSemanticQueryTrace(metadata.semanticQueryTrace) ??
          semanticQueryTrace;
        providerMetadata = {
          ...providerMetadata,
          ...extractProviderMetadata(metadata),
        };
        toolResultSummaries = Array.isArray(metadata.toolResultSummaries)
          ? (metadata.toolResultSummaries as typeof toolResultSummaries)
          : toolResultSummaries;

        await updateJobProgress(
          jobId,
          'finalizing',
          90,
          '응답 완료 처리 중...',
          buildProgressMetadata({
            executionPath,
            handoffs,
            agent: finalAgent,
          })
        );

        completedSuccessfully = true;
      }
    }

    if (!completedSuccessfully) {
      throw new Error('Job stream ended without a completion event');
    }

    await updateJobProgress(
      jobId,
      'completed',
      100,
      '완료',
      buildProgressMetadata({
        executionPath,
        handoffs,
        agent: finalAgent,
      })
    );
    await storeJobResult(jobId, responseChunks.join(''), {
      targetAgent: finalAgent,
      toolResults,
      toolsCalled,
      ragSources,
      evidenceCards,
      metadata: {
        ...(analysisMode && { analysisMode }),
        ...(typeof enableRAG === 'boolean' && { enableRAG }),
        ...(enableWebSearch !== undefined && { enableWebSearch }),
        ...(localRouteDecision && { localRouteDecision }),
        ...(queryAsOf && { queryAsOf }),
        ...(retrieval && { retrieval }),
        ...(traceId && { traceId }),
        ...(routeDecision !== undefined && { routeDecision }),
        ...(assistantPlan !== undefined && { assistantPlan }),
        ...(assistantResult !== undefined && { assistantResult }),
        ...(semanticQueryTrace && { semanticQueryTrace }),
        ...providerMetadata,
        handoffs,
        ...(toolResultSummaries && toolResultSummaries.length > 0 && {
          toolResultSummaries,
        }),
      },
      startedAt,
    });

    const processingTime = Date.now() - startTime;
    logger.info(
      `[Jobs] Job ${jobId} completed in ${processingTime}ms (finalAgent: ${finalAgent ?? 'unknown'})`
    );

    return { status: 'completed' };
  } catch (error) {
    const publicError = getPublicErrorResponse(error);
    const errorDetails = extractJobErrorDetails(error, publicError.message);
    const failureMessage =
      errorDetails?.kind === 'rate-limit'
        ? errorDetails.message
        : publicError.message;
    logger.error(
      { err: error, code: publicError.code },
      `[Jobs] Job ${jobId} failed`
    );
    await storeJobError(jobId, failureMessage, startedAt, errorDetails);
    return { status: 'failed', error: failureMessage };
  }
}
