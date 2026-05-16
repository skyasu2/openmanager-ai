import { hasToolCall, stepCountIs } from 'ai';
import { getAgentMaxSteps } from './agent-runtime-policy';

export type AgentLoopImplementation =
  | 'tool-loop-agent'
  | 'core-generate-text'
  | 'core-stream-text'
  | 'deterministic-pipeline';

export type AgentLoopSurface =
  | 'tool-loop-agent'
  | 'forced-routing'
  | 'agent-stream'
  | 'deterministic-pipeline';

export interface AgentLoopTelemetry {
  implementation: AgentLoopImplementation;
  maxSteps: number;
  maxOutputTokens: number;
  sdkMaxRetries: number;
  stepsExecuted?: number;
}

export interface AgentLoopSettings extends AgentLoopTelemetry {
  stopWhen: ReturnType<typeof buildAgentStopWhen>;
}

interface AgentLoopSettingOverrides {
  maxSteps?: number;
  maxOutputTokens?: number;
  sdkMaxRetries?: number;
}

const DEFAULT_AGENT_MAX_OUTPUT_TOKENS = 2048;
const TOOL_LOOP_AGENT_MAX_RETRIES = 1;
const DIRECT_CORE_MAX_RETRIES = 0;

export function buildAgentStopWhen(maxSteps: number) {
  return [hasToolCall('finalAnswer'), stepCountIs(maxSteps)];
}

function resolveImplementation(
  surface: AgentLoopSurface
): AgentLoopImplementation {
  switch (surface) {
    case 'tool-loop-agent':
      return 'tool-loop-agent';
    case 'forced-routing':
      return 'core-generate-text';
    case 'agent-stream':
      return 'core-stream-text';
    case 'deterministic-pipeline':
      return 'deterministic-pipeline';
  }
}

function resolveSdkMaxRetries(surface: AgentLoopSurface): number {
  return surface === 'tool-loop-agent'
    ? TOOL_LOOP_AGENT_MAX_RETRIES
    : DIRECT_CORE_MAX_RETRIES;
}

export function buildAgentLoopSettings(
  agentName: string,
  surface: AgentLoopSurface,
  overrides: AgentLoopSettingOverrides = {}
): AgentLoopSettings {
  const maxSteps = overrides.maxSteps ?? getAgentMaxSteps(agentName);
  const maxOutputTokens =
    overrides.maxOutputTokens ?? DEFAULT_AGENT_MAX_OUTPUT_TOKENS;
  const sdkMaxRetries =
    overrides.sdkMaxRetries ?? resolveSdkMaxRetries(surface);

  return {
    implementation: resolveImplementation(surface),
    maxSteps,
    maxOutputTokens,
    sdkMaxRetries,
    stopWhen: buildAgentStopWhen(maxSteps),
  };
}

export function toAgentLoopTelemetry(
  settings: AgentLoopSettings,
  stepsExecuted?: number
): AgentLoopTelemetry {
  return {
    implementation: settings.implementation,
    maxSteps: settings.maxSteps,
    maxOutputTokens: settings.maxOutputTokens,
    sdkMaxRetries: settings.sdkMaxRetries,
    ...(stepsExecuted !== undefined ? { stepsExecuted } : {}),
  };
}
