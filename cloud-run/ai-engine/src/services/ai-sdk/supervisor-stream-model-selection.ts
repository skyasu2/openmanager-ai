import type { LanguageModel } from 'ai';
import { getPublicErrorMessage } from '../../lib/error-handler';
import { logger } from '../../lib/logger';
import {
  getSupervisorModel,
  getVisionAgentModel,
  logProviderStatus,
  type ProviderName,
} from './model-provider';
import type { StreamEvent } from './supervisor-types';

type SupervisorStreamModelSelection =
  | {
      ok: true;
      model: LanguageModel;
      provider: ProviderName;
      modelId: string;
    }
  | {
      ok: false;
      event: StreamEvent;
    };

export function selectSupervisorStreamModel({
  attempt,
  hasImages,
  imageCount,
  excludedProviders,
}: {
  attempt: number;
  hasImages: boolean;
  imageCount: number;
  excludedProviders: ProviderName[];
}): SupervisorStreamModelSelection {
  if (attempt === 0) logProviderStatus();

  if (!hasImages) {
    return {
      ok: true,
      ...getSupervisorModel(excludedProviders),
    };
  }

  const visionModel = getVisionAgentModel();
  if (!visionModel) {
    return {
      ok: false,
      event: {
        type: 'error',
        data: {
          code: 'NO_VISION_PROVIDER',
          message: getPublicErrorMessage('NO_VISION_PROVIDER'),
        },
      },
    };
  }

  logger.info(`[SingleAgent] Using Vision Agent (Gemini) for ${imageCount} image(s)`);

  return {
    ok: true,
    model: visionModel.model,
    provider: visionModel.provider,
    modelId: visionModel.modelId,
  };
}
