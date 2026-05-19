/**
 * Agent Configurations (SSOT)
 *
 * Single Source of Truth for all agent configurations.
 * This file centralizes agent settings to eliminate DRY violations.
 *
 * Architecture:
 * - Instructions: Imported from ./instructions/
 * - Tools: Resolved through the runtime host tool boundary
 * - Models: Configured via getModel functions with fallback chains
 *
 * @version 1.0.0
 * @created 2026-01-06
 */

import type { ToolSet } from 'ai';

// Tool type from AI SDK
type ToolsMap = ToolSet;
export type AgentVisibility = 'routable' | 'pipeline-internal';

// Instructions
import {
  NLQ_INSTRUCTIONS,
  getNlqInstructions,
  ANALYST_INSTRUCTIONS,
  REPORTER_INSTRUCTIONS,
  ADVISOR_INSTRUCTIONS,
  VISION_INSTRUCTIONS,
} from './instructions';

// Model providers
import {
  getAdvisorModel,
  getAnalystModel,
  getNlqModel,
  getReporterModel,
  getVisionModel,
  type ModelResult,
} from './agent-model-selectors';
export type { ModelResult } from './agent-model-selectors';
import {
  EVALUATOR_AGENT_INSTRUCTIONS,
  OPTIMIZER_AGENT_INSTRUCTIONS,
} from './agent-pipeline-instructions';
import { getAgentToolAllowlist } from './agent-runtime-policy';
import { resolveDefaultMonitoringAgentTools } from './agent-tool-registry';
import { resolveMonitoringAgentRoleByRuntimeConfigKey } from '../../../../domains/monitoring/agent-roles';
import {
  METRICS_QUERY_AGENT_NAME,
  normalizeAgentRuntimeName,
} from '../../../../core/assistant-runtime/agent-name-compat';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent display name */
  name: string;
  /** Description for orchestrator routing decisions */
  description: string;
  /** Function to get model with fallback chain */
  getModel: () => ModelResult | null;
  /** Agent instructions (system prompt) */
  instructions: string;
  /** Optional dynamic system prompt resolver for query-specific context */
  getInstructions?: (query: string) => string;
  /** Available tools for the agent */
  tools: ToolsMap;
  /** Public routing/factory exposure. Pipeline stages are cataloged but not routable. */
  visibility: AgentVisibility;
  /**
   * Metadata-only catalog hints.
   * Runtime query matching is owned by routing/query-routing-signals.ts.
   */
  matchPatterns: (string | RegExp)[];
}

// ============================================================================
// Agent Configurations (SSOT)
// ============================================================================

export const AGENT_NAMES = [
  METRICS_QUERY_AGENT_NAME,
  'Analyst Agent',
  'Reporter Agent',
  'Advisor Agent',
  'Evaluator Agent',
  'Optimizer Agent',
  'Vision Agent',
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

function buildAgentTools(agentName: AgentName): ToolsMap {
  return resolveDefaultMonitoringAgentTools(getAgentToolAllowlist(agentName));
}

function getDomainAgentRole(agentName: AgentName) {
  const role = resolveMonitoringAgentRoleByRuntimeConfigKey(agentName);
  if (!role) {
    throw new Error(
      `[AgentConfig] Missing monitoring agent role manifest for ${agentName}`
    );
  }

  return {
    description: role.description,
    matchPatterns: role.matchPatterns ?? [],
  };
}

export const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
  'Metrics Query Agent': {
    name: 'Metrics Query Agent',
    description: getDomainAgentRole('Metrics Query Agent').description,
    getModel: getNlqModel,
    instructions: NLQ_INSTRUCTIONS,
    getInstructions: getNlqInstructions,
    tools: buildAgentTools('Metrics Query Agent'),
    visibility: 'routable',
    matchPatterns: [...getDomainAgentRole('Metrics Query Agent').matchPatterns],
  },

  'Analyst Agent': {
    name: 'Analyst Agent',
    description: getDomainAgentRole('Analyst Agent').description,
    getModel: getAnalystModel,
    instructions: ANALYST_INSTRUCTIONS,
    tools: buildAgentTools('Analyst Agent'),
    visibility: 'routable',
    matchPatterns: [...getDomainAgentRole('Analyst Agent').matchPatterns],
  },

  'Reporter Agent': {
    name: 'Reporter Agent',
    description: getDomainAgentRole('Reporter Agent').description,
    getModel: getReporterModel,
    instructions: REPORTER_INSTRUCTIONS,
    tools: buildAgentTools('Reporter Agent'),
    visibility: 'routable',
    matchPatterns: [...getDomainAgentRole('Reporter Agent').matchPatterns],
  },

  'Advisor Agent': {
    name: 'Advisor Agent',
    description: getDomainAgentRole('Advisor Agent').description,
    getModel: getAdvisorModel,
    instructions: ADVISOR_INSTRUCTIONS,
    tools: buildAgentTools('Advisor Agent'),
    visibility: 'routable',
    matchPatterns: [...getDomainAgentRole('Advisor Agent').matchPatterns],
  },

  // =========================================================================
  // Evaluator-Optimizer Pattern Agents (for Reporter Pipeline)
  // =========================================================================

  // =========================================================================
  // Pipeline-Internal Agents (deterministic scoring, no LLM calls)
  //
  // Evaluator와 Optimizer는 reporter-pipeline.ts에서 결정론적으로 실행됩니다.
  // - Evaluator: 4차원 가중 평균 스코어링 (structure/completeness/accuracy/actionability)
  // - Optimizer: precomputed-state 히스토리 기반 근본원인 보강 + CLI 명령어 추가
  //
  // getModel은 AgentConfig 인터페이스 호환용으로 유지되지만, 실제 LLM 호출 없이
  // reporter-pipeline-score-utils.ts의 결정론적 함수들이 평가/개선을 수행합니다.
  // =========================================================================

  'Evaluator Agent': {
    name: 'Evaluator Agent',
    description: getDomainAgentRole('Evaluator Agent').description,
    getModel: getNlqModel, // Interface 호환용 (실제 LLM 호출 없음)
    instructions: EVALUATOR_AGENT_INSTRUCTIONS,
    tools: buildAgentTools('Evaluator Agent'),
    visibility: 'pipeline-internal',
    matchPatterns: [...getDomainAgentRole('Evaluator Agent').matchPatterns],
  },

  'Optimizer Agent': {
    name: 'Optimizer Agent',
    description: getDomainAgentRole('Optimizer Agent').description,
    getModel: getAdvisorModel, // Interface 호환용 (실제 LLM 호출 없음)
    instructions: OPTIMIZER_AGENT_INSTRUCTIONS,
    tools: buildAgentTools('Optimizer Agent'),
    visibility: 'pipeline-internal',
    matchPatterns: [...getDomainAgentRole('Optimizer Agent').matchPatterns],
  },

  // =========================================================================
  // Vision Agent (Gemini Flash → Z.AI Vision fallback)
  // =========================================================================

  'Vision Agent': {
    name: 'Vision Agent',
    description: getDomainAgentRole('Vision Agent').description,
    getModel: getVisionModel, // Gemini → Z.AI Vision fallback
    instructions: VISION_INSTRUCTIONS,
    tools: buildAgentTools('Vision Agent'),
    visibility: 'routable',
    matchPatterns: [...getDomainAgentRole('Vision Agent').matchPatterns],
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all agent names
 */
export function getAgentNames(): AgentName[] {
  return [...AGENT_NAMES];
}

export function isAgentName(name: string): name is AgentName {
  return Object.prototype.hasOwnProperty.call(AGENT_CONFIGS, name);
}

export function normalizeAgentName(name: string): AgentName | undefined {
  const normalizedName = normalizeAgentRuntimeName(name);
  return isAgentName(normalizedName) ? normalizedName : undefined;
}

/**
 * Get agent config by name
 */
export function getAgentConfig(name: AgentName): AgentConfig;
export function getAgentConfig(name: string): AgentConfig | undefined;
export function getAgentConfig(name: string): AgentConfig | undefined {
  const normalizedName = normalizeAgentName(name);
  return normalizedName ? AGENT_CONFIGS[normalizedName] : undefined;
}

export function getAgentInstructions(
  config: AgentConfig,
  query: string
): string {
  return config.getInstructions?.(query) ?? config.instructions;
}

/**
 * Check if agent is available (has valid model and is routable)
 */
export function isAgentAvailable(name: AgentName): boolean;
export function isAgentAvailable(name: string): boolean {
  const config = getAgentConfig(name);
  if (!config) return false;
  if (config.visibility === 'pipeline-internal') return false;
  return config.getModel() !== null;
}

/**
 * Get all available agents
 */
export function getAvailableAgents(): AgentName[] {
  return AGENT_NAMES.filter((name) => isAgentAvailable(name));
}
