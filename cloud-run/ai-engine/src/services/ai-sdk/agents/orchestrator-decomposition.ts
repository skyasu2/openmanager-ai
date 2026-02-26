/**
 * Orchestrator Decomposition Logic
 *
 * Task decomposition and parallel execution.
 *
 * @version 4.0.0
 */

import { taskDecomposeSchema, type TaskDecomposition, type Subtask } from './schemas';
import { TIMEOUT_CONFIG } from '../../../config/timeout-config';

import type { MultiAgentResponse } from './orchestrator-types';
import { getOrchestratorModel, getAgentConfig, executeForcedRouting } from './orchestrator-routing';
import { saveAgentFindingsToContext } from './orchestrator-context';
import { logger } from '../../../lib/logger';
import { generateObjectWithFallback } from './orchestrator-object-fallback';

// ============================================================================
// Task Decomposition (Orchestrator-Worker Pattern)
// ============================================================================

const COMPLEXITY_INDICATORS = [
  /그리고|또한|동시에|함께/,
  /비교|차이|대비/,
  /분석.*보고서|보고서.*분석/,
  /전체.*상세|상세.*전체/,
];

function isComplexQuery(query: string): boolean {
  const matchCount = COMPLEXITY_INDICATORS.filter(pattern => pattern.test(query)).length;
  return matchCount >= 2 || query.length > 100;
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

  const { model } = modelConfig;

  try {
    logger.info('[Decompose] Analyzing complex query for task decomposition...');

    const decomposePrompt = `다음 복합 질문을 서브태스크로 분해하세요.

## 사용 가능한 에이전트
- NLQ Agent: 서버 상태 조회, 메트릭 필터링/집계
- Analyst Agent: 이상 탐지, 트렌드 예측, 근본 원인 분석
- Reporter Agent: 장애 보고서, 인시던트 타임라인
- Advisor Agent: 해결 방법, CLI 명령어, 과거 사례
- Vision Agent: 스크린샷 분석, 대용량 로그, 최신 문서 검색 (Gemini)

## 사용자 질문
${query}

## 분해 가이드라인
- 각 서브태스크는 하나의 에이전트가 독립적으로 처리할 수 있어야 함
- 의존성이 있으면 requiresSequential=true
- 최대 4개의 서브태스크로 제한
- Vision Agent는 이미지/스크린샷이 필요한 경우에만 할당`;

    const result = await generateObjectWithFallback({
      model,
      schema: taskDecomposeSchema,
      system: '복합 질문을 서브태스크로 분해하는 전문가입니다.',
      prompt: decomposePrompt,
      temperature: 0.2,
      operation: 'orchestrator-decomposition',
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
  sessionId = ''
): Promise<MultiAgentResponse | null> {
  logger.info(`[Parallel] Executing ${subtasks.length} subtasks in parallel...`);

  const SUBTASK_TIMEOUT_MS = TIMEOUT_CONFIG.subtask.hard;

  const subtaskPromises = subtasks.map(async (subtask, index) => {
    logger.info(`   [${index + 1}/${subtasks.length}] ${subtask.agent}: ${subtask.task.substring(0, 50)}...`);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isTimedOut = false;

    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        isTimedOut = true;
        logger.warn(
          `[Parallel] Subtask ${index + 1}/${subtasks.length} timeout after ${SUBTASK_TIMEOUT_MS}ms\n` +
          `   Agent: ${subtask.agent}\n` +
          `   Task: "${subtask.task.substring(0, 80)}${subtask.task.length > 80 ? '...' : ''}"`
        );
        resolve(null);
      }, SUBTASK_TIMEOUT_MS);
    });

    const executionPromise = executeForcedRouting(
      subtask.task,
      subtask.agent,
      startTime,
      webSearchEnabled
    );

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);

      if (timeoutId !== null && !isTimedOut) {
        clearTimeout(timeoutId);
      }

      return { subtask, result, index };
    } catch (error) {
      if (timeoutId !== null && !isTimedOut) {
        clearTimeout(timeoutId);
      }
      logger.error(`[Parallel] Subtask ${index + 1} error:`, error);
      return { subtask, result: null, index };
    }
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
      durationMs,
    },
  };
}

function unifyResults(
  agentResults: Array<{ agent: string; response: string }>
): string {
  if (agentResults.length === 0) {
    return '결과를 생성할 수 없습니다.';
  }

  if (agentResults.length === 1) {
    return agentResults[0].response;
  }

  const sections = agentResults.map(({ agent, response }) => {
    const agentLabel = agent.replace(' Agent', '');
    return `## ${agentLabel} 분석\n${response}`;
  });

  return `# 종합 분석 결과\n\n${sections.join('\n\n---\n\n')}`;
}
