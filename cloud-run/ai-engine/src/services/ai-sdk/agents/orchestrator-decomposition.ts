/**
 * Orchestrator Decomposition Logic
 *
 * Task decomposition and parallel execution.
 *
 * @version 4.0.0
 */

import { taskDecomposeSchema, type TaskDecomposition, type Subtask } from './schemas';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';

import type { DomainDataSource } from '../../../core/assistant-runtime';
import type { StreamEvent } from '../supervisor';
import type { FileAttachment, ImageAttachment } from './base-agent';
import type { MultiAgentRequest, MultiAgentResponse } from './orchestrator-types';
import {
  getOrchestratorModel,
  getAgentConfig,
  executeForcedRouting,
  ORCHESTRATOR_PROVIDER_ORDER,
} from './orchestrator-routing';
import { saveAgentFindingsToContext } from './orchestrator-context';
import { logger } from '../../../lib/logger';
import { generateStructuredOutputWithFallback } from './orchestrator-object-fallback';
import {
  streamTextInChunks,
  unifyResults,
} from './orchestrator-decomposition-output';

// ============================================================================
// Task Decomposition (Orchestrator-Worker Pattern)
// ============================================================================

const COMPLEXITY_INDICATORS = [
  /그리고|또한|동시에|함께/,
  /비교|차이|대비/,
  /분석.*보고서|보고서.*분석/,
  /전체.*상세|상세.*전체/,
  /상태.*분석|분석.*상태/,
  /이상.*해결|해결.*이상/,
  /장애.*원인.*조치|원인.*조치/,
];

function isComplexQuery(query: string): boolean {
  const matchCount = COMPLEXITY_INDICATORS.filter(pattern => pattern.test(query)).length;
  return matchCount >= 2 || (matchCount >= 1 && query.length >= 20) || query.length > 100;
}

async function executeSubtaskWithTimeout(
  subtask: Subtask,
  index: number,
  total: number,
  startTime: number,
  webSearchEnabled: boolean,
  ragEnabled: boolean,
  images: ImageAttachment[] | undefined,
  files: FileAttachment[] | undefined,
  dataSource: DomainDataSource | undefined,
  domainId: string | undefined,
  internalDisclosureMode: MultiAgentRequest['internalDisclosureMode'] | undefined,
  domainEvidencePrompt: string | undefined,
  logPrefix: string
): Promise<MultiAgentResponse | null> {
  const subtaskTimeoutMs = TIMEOUT_CONFIG.subtask.hard;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isTimedOut = false;

  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      isTimedOut = true;
      logger.warn(
        `[${logPrefix}] Subtask ${index + 1}/${total} timeout after ${subtaskTimeoutMs}ms\n` +
          `   Agent: ${subtask.agent}\n` +
          `   Task: "${subtask.task.substring(0, 80)}${subtask.task.length > 80 ? '...' : ''}"`
      );
      resolve(null);
    }, subtaskTimeoutMs);
  });

  const executionPromise = executeForcedRouting(
    subtask.task,
    subtask.agent,
    startTime,
    webSearchEnabled,
    ragEnabled,
    images,
    files,
    undefined,
    dataSource,
    domainId,
    internalDisclosureMode,
    domainEvidencePrompt
  );

  try {
    const result = await Promise.race([executionPromise, timeoutPromise]);

    if (timeoutId !== null && !isTimedOut) {
      clearTimeout(timeoutId);
    }

    return result;
  } catch (error) {
    if (timeoutId !== null && !isTimedOut) {
      clearTimeout(timeoutId);
    }
    logger.error(`[${logPrefix}] Subtask ${index + 1} error:`, error);
    return null;
  }
}

export async function decomposeTask(query: string): Promise<TaskDecomposition | null> {
  if (!isComplexQuery(query)) {
    logger.info('[Decompose] Query is simple, skipping decomposition');
    return null;
  }

  const modelConfig = getOrchestratorModel();
  if (!modelConfig) {
    logger.warn('[Decompose] No model available');
    return null;
  }

  const { model, provider, modelId } = modelConfig;

  try {
    logger.info('[Decompose] Analyzing complex query for task decomposition...');

    const decomposePrompt = `다음 복합 질문을 서브태스크로 분해하세요.

## 사용 가능한 에이전트
- NLQ Agent: 서버 상태 조회, 메트릭 필터링/집계
- Analyst Agent: 이상 탐지, 트렌드 예측, 근본 원인 분석
- Reporter Agent: 장애 보고서, 인시던트 타임라인
- Advisor Agent: 해결 방법, CLI 명령어, 과거 사례
- Vision Agent: 스크린샷/이미지 분석 (Gemini)

## 사용자 질문
${query}

## 분해 가이드라인
- 각 서브태스크는 하나의 에이전트가 독립적으로 처리할 수 있어야 함
- 의존성이 있으면 requiresSequential=true
- 최대 4개의 서브태스크로 제한
- Vision Agent는 첨부 이미지/스크린샷이 필요한 경우에만 할당`;

    const result = await generateStructuredOutputWithFallback({
      model,
      schema: taskDecomposeSchema,
      system: '복합 질문을 서브태스크로 분해하는 전문가입니다.',
      prompt: decomposePrompt,
      temperature: 0.2,
      operation: 'orchestrator-decomposition',
      provider,
      modelId,
      providerFallback: {
        agentLabel: 'Orchestrator',
        providerOrder: ORCHESTRATOR_PROVIDER_ORDER,
        cbPrefix: 'orchestrator',
      },
    });

    const decomposition = result.object;
    logger.info(`[Decompose] Created ${decomposition.subtasks.length} subtasks (sequential: ${decomposition.requiresSequential})`);

    const validSubtasks = decomposition.subtasks.filter((subtask: Subtask) => {
      const agentConfig = getAgentConfig(subtask.agent);

      if (!agentConfig) {
        logger.warn(`[Decompose] Agent "${subtask.agent}" not found, removing subtask: "${subtask.task.substring(0, 40)}..."`);
        return false;
      }

      const modelResult = agentConfig.getModel();
      if (!modelResult) {
        logger.warn(`[Decompose] Agent "${subtask.agent}" model unavailable, removing subtask: "${subtask.task.substring(0, 40)}..."`);
        return false;
      }

      return true;
    });

    if (validSubtasks.length === 0) {
      logger.warn('[Decompose] No valid subtasks after validation, falling back to single-agent');
      return null;
    }

    if (validSubtasks.length !== decomposition.subtasks.length) {
      logger.info(`[Decompose] Validated: ${validSubtasks.length}/${decomposition.subtasks.length} subtasks kept`);
    }

    return {
      ...decomposition,
      subtasks: validSubtasks,
    };
  } catch (error) {
    logger.error('[Decompose] Task decomposition failed:', error);
    return null;
  }
}

// ============================================================================
// Parallel Execution
// ============================================================================

export async function executeParallelSubtasks(
  subtasks: Subtask[],
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  sessionId = '',
  images?: ImageAttachment[],
  files?: FileAttachment[],
  dataSource?: DomainDataSource,
  domainId?: string,
  internalDisclosureMode?: MultiAgentRequest['internalDisclosureMode']
): Promise<MultiAgentResponse | null> {
  logger.info(`[Parallel] Executing ${subtasks.length} subtasks in parallel...`);

  const subtaskPromises = subtasks.map(async (subtask, index) => {
    logger.info(`   [${index + 1}/${subtasks.length}] ${subtask.agent}: ${subtask.task.substring(0, 50)}...`);
    const result = await executeSubtaskWithTimeout(
      subtask,
      index,
      subtasks.length,
      startTime,
      webSearchEnabled,
      ragEnabled,
      images,
      files,
      dataSource,
      domainId,
      internalDisclosureMode,
      undefined,
      'Parallel'
    );
    return { subtask, result, index };
  });

  const results = await Promise.all(subtaskPromises);

  const successfulResults = results.filter(r => r.result !== null);
  const failedResults = results.filter(r => r.result === null);

  if (failedResults.length > 0) {
    logger.warn(
      `[Parallel] ${failedResults.length}/${results.length} subtasks failed:\n` +
      failedResults.map(r => `   - [${r.index + 1}] ${r.subtask.agent}: "${r.subtask.task.substring(0, 50)}..."`).join('\n')
    );
  }

  if (successfulResults.length === 0) {
    logger.error('[Parallel] All subtasks failed - no results to aggregate');
    return null;
  }

  const unifiedResponse = unifyResults(
    successfulResults.map(r => ({
      agent: r.subtask.agent,
      response: r.result!.response,
    }))
  );

  const durationMs = Date.now() - startTime;
  const handoffs = successfulResults.flatMap(r => r.result!.handoffs);
  const toolsCalled = [...new Set(successfulResults.flatMap(r => r.result!.toolsCalled))];
  const totalTokens = successfulResults.reduce((sum, r) => sum + (r.result!.usage?.totalTokens ?? 0), 0);

  logger.info(`[Parallel] Completed ${successfulResults.length}/${subtasks.length} subtasks in ${durationMs}ms`);

  if (sessionId) {
    for (const result of successfulResults) {
      await saveAgentFindingsToContext(sessionId, result.subtask.agent, result.result!.response);
    }
  }

  return {
    success: true,
    response: unifiedResponse,
    handoffs,
    finalAgent: 'Orchestrator (Multi-Agent)',
    toolsCalled,
    usage: {
      promptTokens: successfulResults.reduce((sum, r) => sum + (r.result!.usage?.promptTokens ?? 0), 0),
      completionTokens: successfulResults.reduce((sum, r) => sum + (r.result!.usage?.completionTokens ?? 0), 0),
      totalTokens,
    },
    metadata: {
      provider: 'multi-agent',
      modelId: 'orchestrator-worker',
      totalRounds: successfulResults.length,
      handoffCount: handoffs.length,
      durationMs,
    },
  };
}

export { streamTextInChunks, unifyResults } from './orchestrator-decomposition-output';

// ============================================================================
// Streaming Parallel/Sequential Execution (Collect-then-Stream)
// ============================================================================

/**
 * Execute subtasks in parallel with progress events, then stream unified result.
 * "Collect-then-Stream" pattern: collect non-streaming results → unify → stream.
 */
export async function* executeParallelSubtasksStream(
  subtasks: Subtask[],
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  sessionId = '',
  images?: ImageAttachment[],
  files?: FileAttachment[],
  dataSource?: DomainDataSource,
  domainId?: string,
  internalDisclosureMode?: MultiAgentRequest['internalDisclosureMode'],
  domainEvidencePrompt?: string
): AsyncGenerator<StreamEvent> {
  logger.info(`[ParallelStream] Executing ${subtasks.length} subtasks in parallel...`);

  // Emit agent_status immediately for fast TTFT
  yield {
    type: 'agent_status',
    data: {
      agent: 'Orchestrator',
      status: 'processing',
      subtaskCount: subtasks.length,
      agents: subtasks.map(s => s.agent),
      message: `${subtasks.length}개 서브태스크로 분할하여 병렬 처리 중...`,
    },
  };

  const subtaskPromises = subtasks.map(async (subtask, index) => {
    logger.info(`   [${index + 1}/${subtasks.length}] ${subtask.agent}: ${subtask.task.substring(0, 50)}...`);
    const result = await executeSubtaskWithTimeout(
      subtask,
      index,
      subtasks.length,
      startTime,
      webSearchEnabled,
      ragEnabled,
      images,
      files,
      dataSource,
      domainId,
      internalDisclosureMode,
      domainEvidencePrompt,
      'ParallelStream'
    );
    return { subtask, result, index };
  });

  const results = await Promise.all(subtaskPromises);
  const successfulResults = results.filter(r => r.result !== null);
  const failedResults = results.filter(r => r.result === null);
  const failedAgents = failedResults.map(r => r.subtask.agent);

  if (successfulResults.length === 0) {
    logger.error('[ParallelStream] All subtasks failed');
    yield {
      type: 'error',
      data: {
        code: 'ALL_SUBTASKS_FAILED',
        error: '모든 서브태스크가 실패했습니다.',
        metadata: {
          mode: 'parallel',
          subtaskCount: subtasks.length,
          completedCount: 0,
          failedCount: failedResults.length,
          failedAgents,
        },
      },
    };
    return;
  }

  // Emit progress update
  yield {
    type: 'agent_status',
    data: {
      agent: 'Orchestrator',
      status: 'processing',
      completed: successfulResults.length,
      total: subtasks.length,
      message: `${successfulResults.length}/${subtasks.length} 서브태스크 완료, 결과 통합 중...`,
    },
  };

  // Save context for successful results
  if (sessionId) {
    for (const result of successfulResults) {
      await saveAgentFindingsToContext(sessionId, result.subtask.agent, result.result!.response);
    }
  }

  // Unify and stream
  const unifiedResponse = unifyResults(
    successfulResults.map(r => ({ agent: r.subtask.agent, response: r.result!.response }))
  );

  yield* streamTextInChunks(unifiedResponse);

  const durationMs = Date.now() - startTime;
  const toolsCalled = [...new Set(successfulResults.flatMap(r => r.result!.toolsCalled))];
  const totalTokens = successfulResults.reduce((sum, r) => sum + (r.result!.usage?.totalTokens ?? 0), 0);

  logger.info(`[ParallelStream] Completed ${successfulResults.length}/${subtasks.length} subtasks in ${durationMs}ms`);

  yield {
    type: 'done',
    data: {
      success: true,
      finalAgent: 'Orchestrator (Multi-Agent Stream)',
      toolsCalled,
      handoffs: successfulResults.map(r => ({
        from: 'Orchestrator',
        to: r.subtask.agent,
        reason: 'Task decomposition (parallel)',
      })),
      usage: {
        promptTokens: successfulResults.reduce((sum, r) => sum + (r.result!.usage?.promptTokens ?? 0), 0),
        completionTokens: successfulResults.reduce((sum, r) => sum + (r.result!.usage?.completionTokens ?? 0), 0),
        totalTokens,
      },
      metadata: {
        provider: 'multi-agent',
        modelId: 'orchestrator-worker',
        mode: 'parallel',
        durationMs,
        subtaskCount: subtasks.length,
        completedCount: successfulResults.length,
        failedCount: failedResults.length,
        failedAgents,
      },
    },
  };
}

/**
 * Execute subtasks sequentially with progress events, then stream results.
 * Used when subtasks have dependencies (requiresSequential=true).
 */
export async function* executeSequentialSubtasksStream(
  subtasks: Subtask[],
  startTime: number,
  webSearchEnabled = true,
  ragEnabled = true,
  sessionId = '',
  images?: ImageAttachment[],
  files?: FileAttachment[],
  dataSource?: DomainDataSource,
  domainId?: string,
  internalDisclosureMode?: MultiAgentRequest['internalDisclosureMode'],
  domainEvidencePrompt?: string
): AsyncGenerator<StreamEvent> {
  logger.info(`[SequentialStream] Executing ${subtasks.length} subtasks sequentially...`);

  yield {
    type: 'agent_status',
    data: {
      agent: 'Orchestrator',
      status: 'processing',
      subtaskCount: subtasks.length,
      agents: subtasks.map(s => s.agent),
      sequential: true,
      message: `${subtasks.length}개 서브태스크를 순차 처리 중...`,
    },
  };

  const successfulResults: Array<{ subtask: Subtask; result: MultiAgentResponse }> = [];
  const failedAgents: string[] = [];

  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];

    yield {
      type: 'agent_status',
      data: {
        status: 'processing',
        current: i + 1,
        total: subtasks.length,
        agent: subtask.agent,
        message: `[${i + 1}/${subtasks.length}] ${subtask.agent} 실행 중...`,
      },
    };

    const result = await executeSubtaskWithTimeout(
      subtask,
      i,
      subtasks.length,
      startTime,
      webSearchEnabled,
      ragEnabled,
      images,
      files,
      dataSource,
      domainId,
      internalDisclosureMode,
      domainEvidencePrompt,
      'SequentialStream'
    );

    if (!result) {
      logger.warn(`[SequentialStream] Subtask ${i + 1} failed: ${subtask.agent}`);
      failedAgents.push(subtask.agent);
      continue;
    }

    successfulResults.push({ subtask, result });

    if (sessionId) {
      await saveAgentFindingsToContext(sessionId, subtask.agent, result.response);
    }
  }

  if (successfulResults.length === 0) {
    yield {
      type: 'error',
      data: {
        code: 'ALL_SUBTASKS_FAILED',
        error: '모든 순차 서브태스크가 실패했습니다.',
        metadata: {
          mode: 'sequential',
          subtaskCount: subtasks.length,
          completedCount: 0,
          failedCount: failedAgents.length,
          failedAgents,
        },
      },
    };
    return;
  }

  // Unify and stream
  const unifiedResponse = unifyResults(
    successfulResults.map(r => ({ agent: r.subtask.agent, response: r.result.response }))
  );

  yield* streamTextInChunks(unifiedResponse);

  const durationMs = Date.now() - startTime;
  const toolsCalled = [...new Set(successfulResults.flatMap(r => r.result.toolsCalled))];
  const totalTokens = successfulResults.reduce((sum, r) => sum + (r.result.usage?.totalTokens ?? 0), 0);

  logger.info(`[SequentialStream] Completed ${successfulResults.length}/${subtasks.length} subtasks in ${durationMs}ms`);

  yield {
    type: 'done',
    data: {
      success: true,
      finalAgent: 'Orchestrator (Multi-Agent Sequential Stream)',
      toolsCalled,
      handoffs: successfulResults.map(r => ({
        from: 'Orchestrator',
        to: r.subtask.agent,
        reason: 'Task decomposition (sequential)',
      })),
      usage: {
        promptTokens: successfulResults.reduce((sum, r) => sum + (r.result.usage?.promptTokens ?? 0), 0),
        completionTokens: successfulResults.reduce((sum, r) => sum + (r.result.usage?.completionTokens ?? 0), 0),
        totalTokens,
      },
      metadata: {
        provider: 'multi-agent',
        modelId: 'orchestrator-worker-sequential',
        mode: 'sequential',
        durationMs,
        subtaskCount: subtasks.length,
        completedCount: successfulResults.length,
        failedCount: failedAgents.length,
        failedAgents,
      },
    },
  };
}
