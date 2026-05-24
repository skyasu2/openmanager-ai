import type { ToolSet } from 'ai';
import type { DomainEvidenceResult } from '../../core/assistant-runtime';
import { extractToolResultOutput } from '../../lib/ai-sdk-utils';
import { logger } from '../../lib/logger';
import { buildDeterministicSummaryFallback } from './agents/orchestrator-summary-fallback';
import type { ProviderName } from './model-provider';
import {
  buildWebSearchFallbackAnswer,
  hasWebSearchFallbackAnswer,
} from './supervisor-stream-citations';
import {
  executeSearchWebFallbackFromSteps,
  type CollectedToolResult,
} from './supervisor-stream-helpers';
import type { StreamEvent } from './supervisor-types';

type StepToolCallLike = {
  toolName?: unknown;
  input?: unknown;
  args?: unknown;
};

type StepLike = {
  toolCalls?: StepToolCallLike[];
  toolResults?: unknown[];
};

export type SupervisorStreamRecoveryResult = {
  fullText: string;
  firstChunkMs: number | null;
  streamError: Error | null;
};

type SupervisorStreamRecoveryInput = {
  fullText: string;
  firstChunkMs: number | null;
  streamError: Error | null;
  queryText: string;
  domainEvidence?: DomainEvidenceResult | null;
  steps: StepLike[];
  collectedToolResults: CollectedToolResult[];
  filteredTools: ToolSet;
  provider: ProviderName;
  modelId: string;
  providerStartTime: number;
  startTime: number;
};

type GenericEmptySupervisorStreamFallbackInput = {
  streamError: Error | null;
  queryText: string;
  steps: StepLike[];
  provider: ProviderName;
  modelId: string;
  startTime: number;
};

const EMPTY_STREAM_FALLBACK_TEXT =
  '응답 본문이 비어 있어 요약 결과를 생성하지 못했습니다. 질문을 조금 더 구체적으로 다시 시도해 주세요.';

const SERVER_ID_CANDIDATE_PATTERN =
  /\b[a-z][a-z0-9]+(?:-[a-z0-9]+){2,}\b/i;
const ADVISOR_READ_ONLY_ADVICE_INTENT_PATTERN = new RegExp(
  [
    '성능\\s*(?:개선|조언|최적화|튜닝|방법)',
    '(?:개선|조언|최적화|튜닝)\\s*(?:방법|가이드|조언)?',
    'performance\\s+(?:improve|optimi[sz]e|tuning|advice)',
    '(?:improve|optimi[sz]e|tuning)\\s+(?:performance|server)',
  ].join('|'),
  'i'
);
const ADVISOR_READ_ONLY_INFRA_TARGET_PATTERN =
  /서버|server|인프라|시스템|cpu|메모리|memory|디스크|disk|네트워크|network|부하|로드|load|latency|응답\s*시간|response/i;
const WHOLE_FLEET_PATTERN =
  /전체|모든|전부|fleet|all\s+(servers?|nodes?)|whole\s+fleet/i;
const SERVER_GROUP_PATTERN =
  /\b(?:db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs)\b|로드\s*밸런서|캐시|스토리지|백엔드/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readToolResultName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.toolName === 'string' ? value.toolName : null;
}

function readFinalAnswerFromSteps(steps: StepLike[]): string | null {
  for (const step of steps) {
    for (const toolResult of step.toolResults ?? []) {
      if (readToolResultName(toolResult) !== 'finalAnswer') continue;

      const output = extractToolResultOutput(toolResult);
      if (!isRecord(output) || typeof output.answer !== 'string') continue;

      const answer = output.answer.trim();
      if (answer.length > 0) return answer;
    }
  }

  return null;
}

function listToolCallNames(steps: StepLike[]): unknown[] {
  return steps.flatMap((step) =>
    (step.toolCalls ?? []).map((toolCall) => toolCall.toolName)
  );
}

function isAdvisorReadOnlyAdviceQuery(query: string): boolean {
  return (
    ADVISOR_READ_ONLY_ADVICE_INTENT_PATTERN.test(query) &&
    (ADVISOR_READ_ONLY_INFRA_TARGET_PATTERN.test(query) ||
      SERVER_ID_CANDIDATE_PATTERN.test(query))
  );
}

function describeAdvisorAdviceTarget(query: string): string {
  const serverId = query.match(SERVER_ID_CANDIDATE_PATTERN)?.[0];
  if (serverId) {
    return serverId;
  }

  if (WHOLE_FLEET_PATTERN.test(query)) {
    return '전체 서버';
  }

  const group = query.match(SERVER_GROUP_PATTERN)?.[0]?.trim();
  if (group) {
    return `${group} 서버 그룹`;
  }

  return '질문에 지정된 서버 범위';
}

function selectReadOnlyPerformanceCommands(query: string): string[] {
  if (/메모리|memory|mem|oom/i.test(query)) {
    return ['free -h', 'ps aux --sort=-%mem | head -10', 'vmstat 1 5'];
  }

  if (/디스크|disk|storage|스토리지|inode|용량/i.test(query)) {
    return [
      'df -h',
      'df -ih',
      'du -xhd1 / 2>/dev/null | sort -hr | head -20',
    ];
  }

  if (/네트워크|network|traffic|latency|응답\s*시간|대역폭/i.test(query)) {
    return ['ss -s', 'ss -tuna | head -50', 'ip -s link'];
  }

  if (/cpu|씨피유|부하|로드|load/i.test(query)) {
    return [
      'uptime',
      'top -b -n1 -o %CPU | head -20',
      'ps aux --sort=-%cpu | head -10',
    ];
  }

  return [
    'uptime',
    'top -b -n1 -o %CPU | head -20',
    'free -h',
    'df -h',
    'vmstat 1 5',
  ];
}

function buildAdvisorReadOnlyAdviceFallback(query: string): string | null {
  if (!isAdvisorReadOnlyAdviceQuery(query)) {
    return null;
  }

  const target = describeAdvisorAdviceTarget(query);
  const commands = selectReadOnlyPerformanceCommands(query);

  return [
    '## 성능 개선 조언',
    '',
    `대상: ${target}`,
    '',
    '현재 수치를 단정하지 않고, 먼저 읽기 전용 점검으로 병목 지표를 좁히는 방식이 안전합니다.',
    '',
    '### 읽기 전용 점검',
    '```bash',
    ...commands,
    '```',
    '',
    '### 개선 방법',
    '1. CPU, 메모리, 디스크, 네트워크 중 임계치와 추세가 가장 나쁜 지표를 먼저 확인합니다.',
    '2. 같은 역할 서버와 비교해 한 대만 튀는지, 그룹 전체가 함께 상승하는지 분리합니다.',
    '3. 재시작, 삭제, 설정 변경, 스케일 조정은 점검 결과와 영향 범위, 롤백 절차가 준비된 뒤 승인된 절차로만 진행하세요.',
  ].join('\n');
}

export async function* recoverEmptySupervisorStreamOutput(
  input: SupervisorStreamRecoveryInput
): AsyncGenerator<StreamEvent, SupervisorStreamRecoveryResult> {
  let { fullText, firstChunkMs, streamError } = input;

  const emitRecoveredText = function* (
    text: string,
    reason: string
  ): Generator<StreamEvent> {
    fullText = text;
    if (firstChunkMs === null) {
      firstChunkMs = Date.now() - input.providerStartTime;
      logger.info(
        `[SupervisorStream] TTFB recovered via ${reason}: ${firstChunkMs}ms (${input.provider}/${input.modelId})`
      );
    }
    yield { type: 'text_delta', data: fullText };
  };

  const deterministicSummary = buildDeterministicSummaryFallback(
    input.queryText,
    'Supervisor',
    input.collectedToolResults
  );
  if (fullText.trim().length === 0 && deterministicSummary) {
    yield* emitRecoveredText(deterministicSummary, 'deterministic summary');
    logger.info(
      '[SupervisorStream] Recovered response from deterministic tool summary'
    );
    if (streamError !== null) {
      logger.warn(
        '[SupervisorStream] Suppressed stream error after deterministic tool summary recovery:',
        streamError.message
      );
      streamError = null;
    }
  }

  if (fullText.trim().length === 0 && input.domainEvidence) {
    yield* emitRecoveredText(input.domainEvidence.fallback, 'domain evidence');
    streamError = null;
  }

  if (fullText.trim().length === 0) {
    const finalAnswer = readFinalAnswerFromSteps(input.steps);
    if (finalAnswer) {
      yield* emitRecoveredText(finalAnswer, 'finalAnswer');
      logger.info(
        '[SupervisorStream] Recovered response from finalAnswer tool result'
      );
    }
  }

  if (fullText.trim().length === 0) {
    if (!hasWebSearchFallbackAnswer(input.collectedToolResults)) {
      const recoveredSearchWebResult =
        await executeSearchWebFallbackFromSteps(
          input.steps,
          input.queryText,
          input.filteredTools
        );
      if (recoveredSearchWebResult) {
        input.collectedToolResults.push(recoveredSearchWebResult);
      }
    }

    const webSearchFallback = buildWebSearchFallbackAnswer(
      input.collectedToolResults
    );
    if (webSearchFallback) {
      yield* emitRecoveredText(webSearchFallback, 'web search fallback');
      logger.info(
        '[SupervisorStream] Recovered empty response from searchWeb tool result'
      );
    }
  }

  if (fullText.trim().length === 0 && streamError === null) {
    const advisorReadOnlyFallback = buildAdvisorReadOnlyAdviceFallback(
      input.queryText
    );
    if (advisorReadOnlyFallback) {
      yield* emitRecoveredText(
        advisorReadOnlyFallback,
        'Advisor read-only advice fallback'
      );
      logger.info(
        '[SupervisorStream] Recovered Advisor advice response from read-only fallback'
      );
    }
  }

  return {
    fullText,
    firstChunkMs,
    streamError,
  };
}

export async function* emitGenericEmptySupervisorStreamFallback(
  input: GenericEmptySupervisorStreamFallbackInput
): AsyncGenerator<StreamEvent, string> {
  const durationAtEmpty = Date.now() - input.startTime;
  const advisorReadOnlyFallback = buildAdvisorReadOnlyAdviceFallback(
    input.queryText
  );
  if (advisorReadOnlyFallback) {
    logger.warn(
      {
        event: 'advisor_empty_stream_recovered',
        provider: input.provider,
        modelId: input.modelId,
        query: input.queryText.substring(0, 100),
        stepsCount: input.steps.length,
        toolsCalled: listToolCallNames(input.steps),
        durationMs: durationAtEmpty,
        hasStreamError: input.streamError !== null,
        streamErrorMessage: input.streamError?.message ?? null,
      },
      '[SupervisorStream] Empty Advisor advice output recovered with read-only fallback'
    );
    yield { type: 'text_delta', data: advisorReadOnlyFallback };
    return advisorReadOnlyFallback;
  }

  logger.warn(
    {
      event: 'empty_stream_output',
      provider: input.provider,
      modelId: input.modelId,
      query: input.queryText.substring(0, 100),
      stepsCount: input.steps.length,
      toolsCalled: listToolCallNames(input.steps),
      durationMs: durationAtEmpty,
      hasStreamError: input.streamError !== null,
      streamErrorMessage: input.streamError?.message ?? null,
    },
    '[SupervisorStream] Empty stream output — diagnosing root cause'
  );
  yield {
    type: 'warning',
    data: {
      code: 'EMPTY_RESPONSE',
      message: '모델이 빈 응답을 반환했습니다. 기본 안내 문구로 대체합니다.',
    },
  };
  yield { type: 'text_delta', data: EMPTY_STREAM_FALLBACK_TEXT };
  return EMPTY_STREAM_FALLBACK_TEXT;
}
