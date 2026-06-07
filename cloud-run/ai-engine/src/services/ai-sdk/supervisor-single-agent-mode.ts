import type { ToolSet } from 'ai';
import { RETRY_CONFIG, getIntentCategory } from '../../domains/monitoring/routing-policy';
import { logger } from '../../lib/logger';
import type { AssistantRuntimeMetadata } from './monitoring-runtime-host';
import type { ProviderName } from './model-provider';
import {
  buildSupervisorModeMetadata,
  type ResolvedSupervisorModeDecision,
} from './supervisor-mode';
import {
  applyDegradedMetadata,
  type SupervisorDegradedFallbackContext,
} from './supervisor-multi-fallback';
import { shouldRetryForQuality } from './supervisor-quality-retry';
import { normalizeSupervisorIntentFrame } from './supervisor-semantic-metadata';
import type { SupervisorRequest, SupervisorResponse, SupervisorError } from './supervisor-types';
import { executeSupervisorAttempt } from './supervisor-single-agent-attempt';

export async function executeSingleAgentMode(
  request: SupervisorRequest,
  startTime: number,
  degradedFallbackContext?: SupervisorDegradedFallbackContext,
  modeDecision?: ResolvedSupervisorModeDecision,
  runtimeMetadata?: AssistantRuntimeMetadata,
  runtimeTools?: ToolSet
): Promise<SupervisorResponse | SupervisorError> {
  let lastError: SupervisorError | null = null;
  const failedProviders: ProviderName[] = [];
  const queryText =
    request.messages.filter((m) => m.role === 'user').pop()?.content ?? '';
  const intentFrame = normalizeSupervisorIntentFrame(
    request.metadata?.intentFrame
  );
  const queryIntent = getIntentCategory(queryText, intentFrame);

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      logger.info(
        `[Supervisor] Retry attempt ${attempt}/${RETRY_CONFIG.maxRetries}, excluding: [${failedProviders.join(', ')}]`
      );
      await new Promise((r) =>
        setTimeout(r, RETRY_CONFIG.retryDelayMs * attempt)
      );
    }

    const result = await executeSupervisorAttempt(
      request,
      startTime,
      failedProviders,
      degradedFallbackContext,
      modeDecision,
      runtimeMetadata,
      runtimeTools
    );

    if (result.success) {
      const successResult = result as SupervisorResponse;

      if (
        attempt < RETRY_CONFIG.maxRetries &&
        shouldRetryForQuality(successResult, queryIntent)
      ) {
        const degradedProvider = successResult.metadata.provider as ProviderName;
        if (degradedProvider && !failedProviders.includes(degradedProvider)) {
          failedProviders.push(degradedProvider);
        }
        logger.warn(
          `[Supervisor] Quality-based retry triggered (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}): ` +
            `provider=${successResult.metadata.provider}, flags=[${(successResult.metadata.qualityFlags ?? []).join(', ')}]`
        );
        continue;
      }

      successResult.metadata.mode = 'single';
      if (modeDecision) {
        Object.assign(
          successResult.metadata,
          buildSupervisorModeMetadata(modeDecision)
        );
      }
      return applyDegradedMetadata(successResult, degradedFallbackContext);
    }

    lastError = result as SupervisorError;

    const failedProvider = (lastError as unknown as { provider?: ProviderName })
      .provider;
    if (failedProvider && !failedProviders.includes(failedProvider)) {
      failedProviders.push(failedProvider);
      logger.debug(`[Supervisor] Marking ${failedProvider} as failed for retry`);
    }

    if (!RETRY_CONFIG.retryableErrors.includes(lastError.code)) {
      logger.warn(`[Supervisor] Non-retryable error: ${lastError.code}`);
      return lastError;
    }
  }

  return (
    lastError || { success: false, error: 'Unknown error', code: 'UNKNOWN_ERROR' }
  );
}
