import {
  getCerebrasModelId,
  isCerebrasLongContextEnabled,
  isCerebrasToolCallingEnabled,
  isOpenRouterVisionToolCallingEnabled,
} from '../../lib/config-parser';
import type { ModelCapabilities, ProviderName } from './model-provider.types';
import { CEREBRAS_MODEL_POLICIES } from './provider-model-policy';

export type TextProviderName = Extract<ProviderName, 'cerebras' | 'groq' | 'mistral'>;

export interface ModelCapabilityRequirements {
  requireToolCalling?: boolean;
  requireStructuredOutput?: boolean;
  requireVision?: boolean;
  requireLongContext?: boolean;
  minContextTokens?: number;
}

const LONG_CONTEXT_THRESHOLD_TOKENS = 32_768;

function cerebrasSupportsLongContext(modelId = getCerebrasModelId()): boolean {
  return getCerebrasContextWindowTokens(modelId) >= LONG_CONTEXT_THRESHOLD_TOKENS;
}

function getCerebrasContextWindowTokens(modelId = getCerebrasModelId()): number {
  if (!isCerebrasLongContextEnabled()) {
    return 0;
  }

  const policy =
    CEREBRAS_MODEL_POLICIES[
      modelId as keyof typeof CEREBRAS_MODEL_POLICIES
    ];
  return policy && 'contextWindowTokens' in policy
    ? policy.contextWindowTokens
    : 0;
}

export function getProviderCapabilities(
  provider: ProviderName,
  modelId?: string
): ModelCapabilities {
  switch (provider) {
    case 'cerebras':
      return {
        supportsToolCalling: isCerebrasToolCallingEnabled(),
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: cerebrasSupportsLongContext(modelId),
        contextWindowTokens: getCerebrasContextWindowTokens(modelId),
      };
    case 'groq':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: true,
        contextWindowTokens: 131_072,
      };
    case 'mistral':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: false,
        contextWindowTokens: 32_000,
      };
    case 'gemini':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: true,
        supportsLongContext: true,
        contextWindowTokens: 1_000_000,
      };
    case 'openrouter':
      return {
        supportsToolCalling: isOpenRouterVisionToolCallingEnabled(),
        supportsStructuredOutput: true,
        supportsVision: true,
        supportsLongContext: true,
        contextWindowTokens: 128_000,
      };
  }
}

export function getTextProviderCapabilities(
  provider: TextProviderName,
  modelId?: string
): ModelCapabilities {
  return getProviderCapabilities(provider, modelId);
}

export function getCapabilityMismatchReasons(
  capabilities: ModelCapabilities,
  requirements: ModelCapabilityRequirements = {}
): string[] {
  const mismatches: string[] = [];

  if (requirements.requireToolCalling && !capabilities.supportsToolCalling) {
    mismatches.push('tool-calling');
  }

  if (requirements.requireStructuredOutput && !capabilities.supportsStructuredOutput) {
    mismatches.push('structured-output');
  }

  if (requirements.requireVision && !capabilities.supportsVision) {
    mismatches.push('vision');
  }

  if (requirements.requireLongContext && !capabilities.supportsLongContext) {
    mismatches.push('long-context');
  }

  if (
    typeof requirements.minContextTokens === 'number' &&
    (capabilities.contextWindowTokens ?? 0) < requirements.minContextTokens
  ) {
    mismatches.push('context-window');
  }

  return mismatches;
}

export function supportsRequiredCapabilities(
  capabilities: ModelCapabilities,
  requirements: ModelCapabilityRequirements = {}
): boolean {
  return getCapabilityMismatchReasons(capabilities, requirements).length === 0;
}
