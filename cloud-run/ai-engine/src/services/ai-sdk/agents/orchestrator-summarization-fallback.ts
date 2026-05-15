import { generateTextWithRetry } from '../../resilience/retry-with-fallback';
import { extractToolResultOutput } from '../../../lib/ai-sdk-utils';
import { logger } from '../../../lib/logger';
import { MISTRAL_FIRST_PROVIDER_ORDER } from './config';

const SUMMARIZATION_FALLBACK_TIMEOUT_MS = 10_000;
const SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS = 768;
const SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS = 1_000;

type StepWithToolResults = {
  toolResults?: unknown[];
};

export async function summarizeToolResultsIfEmpty(params: {
  query: string;
  suggestedAgentName: string;
  response: string;
  toolsCalled: string[];
  resultSteps: StepWithToolResults[];
}): Promise<string> {
  const { query, suggestedAgentName, response, toolsCalled, resultSteps } = params;
  if (response.trim().length > 0 || toolsCalled.length === 0) {
    return response;
  }

  logger.warn(
    `[Forced Routing] ${suggestedAgentName}: Empty response with ${toolsCalled.length} tool calls - summarization fallback`
  );

  try {
    const uniqueResults = new Map<string, unknown>();
    for (const step of resultSteps) {
      for (const tr of step.toolResults ?? []) {
        const toolName = readToolName(tr);
        if (!uniqueResults.has(toolName)) {
          uniqueResults.set(toolName, extractToolResultOutput(tr));
        }
      }
    }

    const toolResultsSummary = Array.from(uniqueResults.entries())
      .map(
        ([name, result]) =>
          `[${name}]: ${JSON.stringify(result).slice(0, SUMMARIZATION_FALLBACK_TOOL_RESULT_CHARS)}`
      )
      .join('\n\n');

    const summaryResult = await generateTextWithRetry(
      {
        messages: [
          {
            role: 'system',
            content:
              '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.',
          },
          {
            role: 'user',
            content: `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`,
          },
        ],
        temperature: 0.4,
        maxOutputTokens: SUMMARIZATION_FALLBACK_MAX_OUTPUT_TOKENS,
      },
      [...MISTRAL_FIRST_PROVIDER_ORDER],
      { timeoutMs: SUMMARIZATION_FALLBACK_TIMEOUT_MS }
    );

    if (summaryResult.success && summaryResult.result?.text) {
      logger.info(
        `[Forced Routing] Summarization fallback succeeded (${summaryResult.result.text.length} chars)`
      );
      return summaryResult.result.text;
    }
  } catch (summaryError) {
    logger.warn(
      `[Forced Routing] Summarization fallback failed:`,
      summaryError instanceof Error ? summaryError.message : String(summaryError)
    );
  }

  return response;
}

function readToolName(toolResult: unknown): string {
  const raw = toolResult as Record<string, unknown>;
  return typeof raw.toolName === 'string' ? raw.toolName : 'unknownTool';
}
