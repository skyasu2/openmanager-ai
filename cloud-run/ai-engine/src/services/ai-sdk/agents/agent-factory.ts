/**
 * Agent Factory
 *
 * Factory for creating agent instances with unified interface.
 * Supports all agent types with appropriate model configurations.
 *
 * Usage:
 * ```typescript
 * const agent = AgentFactory.create('nlq');
 * if (agent) {
 *   const result = await agent.run('서버 상태 알려줘');
 *   console.log(result.text);
 * }
 * ```
 *
 * @version 1.0.0
 * @created 2026-01-27
 */

import { BaseAgent, type AgentResult, type AgentRunOptions, type AgentStreamEvent } from './base-agent';
import { AGENT_CONFIGS, type AgentConfig } from './config';
import { logger } from '../../../lib/logger';

// ============================================================================
// Agent Type Definitions
// ============================================================================

/**
 * Available agent types
 */
export type AgentType =
  | 'nlq'
  | 'analyst'
  | 'reporter'
  | 'advisor'
  | 'vision'
  | 'evaluator'
  | 'optimizer';

/**
 * Mapping from AgentType to AGENT_CONFIGS key
 */
const AGENT_TYPE_TO_CONFIG_KEY: Record<AgentType, string> = {
  nlq: 'NLQ Agent',
  analyst: 'Analyst Agent',
  reporter: 'Reporter Agent',
  advisor: 'Advisor Agent',
  vision: 'Vision Agent',
  evaluator: 'Evaluator Agent',
  optimizer: 'Optimizer Agent',
};

/**
 * Mapping from AGENT_CONFIGS key to AgentType
 */
const CONFIG_KEY_TO_AGENT_TYPE: Record<string, AgentType> = {
  'NLQ Agent': 'nlq',
  'Analyst Agent': 'analyst',
  'Reporter Agent': 'reporter',
  'Advisor Agent': 'advisor',
  'Vision Agent': 'vision',
  'Evaluator Agent': 'evaluator',
  'Optimizer Agent': 'optimizer',
};

// ============================================================================
// Concrete Agent Implementations
// ============================================================================

/**
 * Generic Agent implementation that wraps any AgentConfig
 */
class ConfigBasedAgent extends BaseAgent {
  private readonly configKey: string;
  private readonly displayName: string;

  constructor(configKey: string) {
    super();
    this.configKey = configKey;
    this.displayName = configKey;
  }

  getName(): string {
    return this.displayName;
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS[this.configKey] ?? null;
  }
}

/**
 * NLQ Agent - Natural Language Query processing
 */
export class NLQAgent extends BaseAgent {
  getName(): string {
    return 'NLQ Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['NLQ Agent'] ?? null;
  }
}

/**
 * Analyst Agent - Anomaly detection, trend prediction, pattern analysis
 */
export class AnalystAgent extends BaseAgent {
  getName(): string {
    return 'Analyst Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Analyst Agent'] ?? null;
  }
}

/**
 * Reporter Agent - Incident reports and timelines
 */
export class ReporterAgent extends BaseAgent {
  getName(): string {
    return 'Reporter Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Reporter Agent'] ?? null;
  }
}

/**
 * Advisor Agent - Troubleshooting guides and command recommendations
 */
export class AdvisorAgent extends BaseAgent {
  getName(): string {
    return 'Advisor Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Advisor Agent'] ?? null;
  }
}

/**
 * Vision Agent - Screenshot analysis, large log analysis, Google Search Grounding
 * Uses Gemini Flash-Lite with OpenRouter fallback
 */
export class VisionAgent extends BaseAgent {
  getName(): string {
    return 'Vision Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Vision Agent'] ?? null;
  }

  /**
   * Vision Agent has special availability check since it uses vision-provider fallback chain
   */
  override isAvailable(): boolean {
    const config = this.getConfig();
    if (!config) return false;
    // Vision Agent is available when Gemini or OpenRouter is configured
    const model = config.getModel();
    return model !== null;
  }
}

/**
 * Evaluator Agent - Report quality evaluation (internal use)
 */
export class EvaluatorAgent extends BaseAgent {
  getName(): string {
    return 'Evaluator Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Evaluator Agent'] ?? null;
  }
}

/**
 * Optimizer Agent - Report quality improvement (internal use)
 */
export class OptimizerAgent extends BaseAgent {
  getName(): string {
    return 'Optimizer Agent';
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS['Optimizer Agent'] ?? null;
  }
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Factory for creating agent instances
 */
export class AgentFactory {
  /**
   * Create an agent instance by type
   *
   * @param type - Agent type to create
   * @returns Agent instance or null if not available
   *
   * @example
   * ```typescript
   * const nlq = AgentFactory.create('nlq');
   * const analyst = AgentFactory.create('analyst');
   * const vision = AgentFactory.create('vision');
   * ```
   */
  static create(type: AgentType): BaseAgent | null {
    let agent: BaseAgent;

    switch (type) {
      case 'nlq':
        agent = new NLQAgent();
        break;
      case 'analyst':
        agent = new AnalystAgent();
        break;
      case 'reporter':
        agent = new ReporterAgent();
        break;
      case 'advisor':
        agent = new AdvisorAgent();
        break;
      case 'vision':
        agent = new VisionAgent();
        break;
      case 'evaluator':
        agent = new EvaluatorAgent();
        break;
      case 'optimizer':
        agent = new OptimizerAgent();
        break;
      default:
        logger.warn(`⚠️ [AgentFactory] Unknown agent type: ${type}`);
        return null;
    }

    // Check availability
    if (!agent.isAvailable()) {
      logger.warn(`⚠️ [AgentFactory] Agent ${agent.getName()} not available (no model)`);
      return null;
    }

    return agent;
  }

  /**
   * Create an agent instance by config key name
   *
   * @param configKey - AGENT_CONFIGS key (e.g., 'NLQ Agent')
   * @returns Agent instance or null if not available
   *
   * @example
   * ```typescript
   * const agent = AgentFactory.createByName('NLQ Agent');
   * ```
   */
  static createByName(configKey: string): BaseAgent | null {
    const type = CONFIG_KEY_TO_AGENT_TYPE[configKey];
    if (!type) {
      // Fallback to generic config-based agent
      const config = AGENT_CONFIGS[configKey];
      if (!config) {
        logger.warn(`⚠️ [AgentFactory] Unknown config key: ${configKey}`);
        return null;
      }

      const agent = new ConfigBasedAgent(configKey);
      if (!agent.isAvailable()) {
        logger.warn(`⚠️ [AgentFactory] Agent ${configKey} not available (no model)`);
        return null;
      }
      return agent;
    }

    return AgentFactory.create(type);
  }

  /**
   * Get all available agent types
   *
   * @returns Array of available agent types
   */
  static getAvailableTypes(): AgentType[] {
    const available: AgentType[] = [];

    for (const type of Object.keys(AGENT_TYPE_TO_CONFIG_KEY) as AgentType[]) {
      const agent = AgentFactory.create(type);
      if (agent) {
        available.push(type);
      }
    }

    return available;
  }

  /**
   * Get availability status for all agent types
   *
   * @returns Record of agent types to availability
   */
  static getAvailabilityStatus(): Record<AgentType, boolean> {
    const status: Record<AgentType, boolean> = {
      nlq: false,
      analyst: false,
      reporter: false,
      advisor: false,
      vision: false,
      evaluator: false,
      optimizer: false,
    };

    for (const type of Object.keys(status) as AgentType[]) {
      const configKey = AGENT_TYPE_TO_CONFIG_KEY[type];
      const config = AGENT_CONFIGS[configKey];
      if (config) {
        status[type] = config.getModel() !== null;
      }
    }

    return status;
  }

  /**
   * Check if a specific agent type is available
   *
   * @param type - Agent type to check
   * @returns true if available
   */
  static isAvailable(type: AgentType): boolean {
    const configKey = AGENT_TYPE_TO_CONFIG_KEY[type];
    const config = AGENT_CONFIGS[configKey];
    if (!config) return false;
    return config.getModel() !== null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create and run an agent in one call
 *
 * @param type - Agent type
 * @param query - Query to process
 * @param options - Run options
 * @returns AgentResult or null if agent unavailable
 */
export async function runAgent(
  type: AgentType,
  query: string,
  options?: AgentRunOptions
): Promise<AgentResult | null> {
  const agent = AgentFactory.create(type);
  if (!agent) return null;
  return agent.run(query, options);
}

/**
 * Create and stream an agent in one call
 *
 * @param type - Agent type
 * @param query - Query to process
 * @param options - Run options
 * @yields AgentStreamEvent
 */
export async function* streamAgent(
  type: AgentType,
  query: string,
  options?: AgentRunOptions
): AsyncGenerator<AgentStreamEvent> {
  const agent = AgentFactory.create(type);
  if (!agent) {
    yield { type: 'error', data: { code: 'AGENT_UNAVAILABLE', error: `Agent ${type} not available` } };
    return;
  }
  yield* agent.stream(query, options);
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_TYPE_TO_CONFIG_KEY, CONFIG_KEY_TO_AGENT_TYPE };
export type { AgentResult, AgentRunOptions, AgentStreamEvent };
