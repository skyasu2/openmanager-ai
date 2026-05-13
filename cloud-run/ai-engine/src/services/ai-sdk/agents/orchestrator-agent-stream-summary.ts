import { generateText, type LanguageModelUsage } from 'ai';
import { sanitizeChineseCharacters } from '../../../lib/text-sanitizer';
import { logger } from '../../../lib/logger';
import {
  markStreamProviderCooldown,
  reconcileStreamQuota,
  reserveStreamQuota,
  type ProviderQuotaReservation,
} from '../stream-quota';
import type { ProviderAttemptTelemetry } from './orchestrator-types';
import {
  buildToolResultsSummary,
  type CollectedToolResult,
  estimateAgentStreamQuotaTokens,
  selectSummarizationModel,
} from './orchestrator-agent-stream-helpers';
import type { ModelResult } from './config/agent-model-selectors';
import type { ProviderName } from '../model-provider.types';

const SUMMARY_MAX_OUTPUT_TOKENS = 1024;
const SUMMARY_SYSTEM_CONTENT =
  '당신은 서버 모니터링 분석 도우미입니다. 아래 도구 실행 결과를 바탕으로 사용자 질문에 한국어로 명확하게 답변하세요. 핵심 데이터를 인용하고 권장 조치를 포함하세요.';

export interface SummarizationFallbackResult {
  summaryText: string;
  responseProvider: ProviderName;
  responseModelId: string;
  responseAttemptNumber: number;
  responseProviderStartTime: number;
  responseUsage?: LanguageModelUsage;
}

export async function runSummarizationFallback({
  query,
  agentName,
  provider,
  modelId,
  providerStartTime,
  providerAttempts,
  attemptIndex,
  excludedProviders,
  collectedToolResults,
  summarizationReason,
  providerAttemptTelemetry,
}: {
  query: string;
  agentName: string;
  provider: ProviderName;
  modelId: string;
  providerStartTime: number;
  providerAttempts: ModelResult[];
  attemptIndex: number;
  excludedProviders: string[];
  collectedToolResults: CollectedToolResult[];
  summarizationReason: string;
  providerAttemptTelemetry: ProviderAttemptTelemetry[];
}): Promise<SummarizationFallbackResult | null> {
  let summaryReservation: ProviderQuotaReservation | null = null;
  let summaryReservationReconciled = false;
  let summaryProviderForCooldown = '';
  let summaryModelIdForCooldown = '';
  const reconcileSummaryQuotaOnce = async (actualTokensUsed: number) => {
    if (summaryReservationReconciled) return;
    await reconcileStreamQuota(summaryReservation, actualTokensUsed);
    summaryReservationReconciled = true;
  };

  try {
    const toolResultsSummary = buildToolResultsSummary(collectedToolResults);
    const summaryModelSelection = selectSummarizationModel(
      providerAttempts,
      attemptIndex,
      excludedProviders
    );
    const {
      model: summaryModel,
      provider: summaryProvider,
      modelId: summaryModelId,
    } = summaryModelSelection.modelResult;
    summaryProviderForCooldown = summaryProvider;
    summaryModelIdForCooldown = summaryModelId;
    const summaryStartTime = Date.now();
    const summaryUserContent = `질문: ${query}\n\n도구 실행 결과:\n${toolResultsSummary}\n\n위 결과를 바탕으로 분석 답변을 작성하세요.`;

    if (summaryModelSelection.delegated) {
      providerAttemptTelemetry.push({
        provider,
        modelId,
        attempt: attemptIndex + 1,
        durationMs: Date.now() - providerStartTime,
        error: summarizationReason,
      });
      logger.info(
        `[Stream ${agentName}] Delegating summarization fallback from ${provider}/${modelId} to ${summaryProvider}/${summaryModelId}`
      );
    }

    summaryReservation = await reserveStreamQuota(
      summaryProvider,
      summaryModelId,
      estimateAgentStreamQuotaTokens(
        [SUMMARY_SYSTEM_CONTENT, summaryUserContent],
        SUMMARY_MAX_OUTPUT_TOKENS
      )
    );
    if (summaryReservation && !summaryReservation.reserved) {
      throw new Error(
        `QUOTA_ADMISSION:${summaryReservation.reason ?? 'unknown'}`
      );
    }

    const summaryResult = await generateText({
      model: summaryModel,
      messages: [
        {
          role: 'system',
          content: SUMMARY_SYSTEM_CONTENT,
        },
        {
          role: 'user',
          content: summaryUserContent,
        },
      ],
      temperature: 0.4,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      maxRetries: 0,
      timeout: { totalMs: 10_000 },
    });
    await reconcileSummaryQuotaOnce(
      summaryResult.usage?.totalTokens ??
        summaryReservation?.estimatedTokens ??
        0
    );

    const summaryText = sanitizeChineseCharacters(
      summaryResult.text?.trim() || ''
    );
    if (!summaryText) return null;

    return {
      summaryText,
      responseProvider: summaryProvider,
      responseModelId: summaryModelId,
      responseAttemptNumber: summaryModelSelection.attemptIndex + 1,
      responseProviderStartTime: summaryStartTime,
      responseUsage: summaryResult.usage,
    };
  } catch (summaryError) {
    const summaryErrorMessage =
      summaryError instanceof Error
        ? summaryError.message
        : String(summaryError);
    await reconcileSummaryQuotaOnce(0);
    if (summaryProviderForCooldown && summaryModelIdForCooldown) {
      await markStreamProviderCooldown(
        summaryProviderForCooldown,
        summaryModelIdForCooldown,
        summaryErrorMessage
      );
    }
    logger.warn(
      `[Stream ${agentName}] Summarization fallback failed:`,
      summaryErrorMessage
    );
    return null;
  }
}
