import {
  isCerebrasToolCallingEnabled,
  isOpenRouterVisionToolCallingEnabled,
} from '../../lib/config-parser';
import type { ModelCapabilities, ProviderName } from './model-provider.types';

export type TextProviderName = Extract<ProviderName, 'cerebras' | 'groq' | 'mistral'>;

export interface ModelCapabilityRequirements {
  requireToolCalling?: boolean;
  requireStructuredOutput?: boolean;
  requireVision?: boolean;
  requireLongContext?: boolean;
}

export function getProviderCapabilities(provider: ProviderName): ModelCapabilities {
  switch (provider) {
    case 'cerebras':
      return {
        supportsToolCalling: isCerebrasToolCallingEnabled(),
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: true,
      };
    case 'groq':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: true,
      };
    case 'mistral':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: false,
        supportsLongContext: false,
      };
    case 'gemini':
      return {
        supportsToolCalling: true,
        supportsStructuredOutput: true,
        supportsVision: true,
        supportsLongContext: true,
      };
    case 'openrouter':
      return {
        supportsToolCalling: isOpenRouterVisionToolCallingEnabled(),
        supportsStructuredOutput: true,
        supportsVision: true,
        supportsLongContext: true,
      };
  }
}

export function getTextProviderCapabilities(provider: TextProviderName): ModelCapabilities {
  return getProviderCapabilities(provider);
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

  return mismatches;
}

export function supportsRequiredCapabilities(
  capabilities: ModelCapabilities,
  requirements: ModelCapabilityRequirements = {}
): boolean {
  return getCapabilityMismatchReasons(capabilities, requirements).length === 0;
}
