/** Factory and convenience helpers for config-driven agent instances. */

import { BaseAgent, type AgentResult, type AgentRunOptions, type AgentStreamEvent } from './base-agent';
import {
  AGENT_CONFIGS,
  getAgentConfig,
  isAgentName,
  type AgentConfig,
  type AgentName,
} from './config';
import { logger } from '../../../lib/logger';
import type { AssistantDomain } from '../../../core/assistant-runtime';

export type AgentType =
  | 'nlq'
  | 'analyst'
  | 'reporter'
  | 'advisor'
  | 'vision'
  | 'evaluator'
  | 'optimizer';

const AGENT_TYPE_TO_CONFIG_KEY: Record<AgentType, AgentName> = {
  nlq: 'NLQ Agent',
  analyst: 'Analyst Agent',
  reporter: 'Reporter Agent',
  advisor: 'Advisor Agent',
  vision: 'Vision Agent',
  evaluator: 'Evaluator Agent',
  optimizer: 'Optimizer Agent',
};

const CONFIG_KEY_TO_AGENT_TYPE = Object.fromEntries(
  Object.entries(AGENT_TYPE_TO_CONFIG_KEY).map(([k, v]) => [v, k])
) as Record<AgentName, AgentType>;

function isAgentType(value: string): value is AgentType {
  return Object.prototype.hasOwnProperty.call(AGENT_TYPE_TO_CONFIG_KEY, value);
}

class ConfigBasedAgent extends BaseAgent {
  private readonly configKey: AgentName;
  private readonly displayName: AgentName;

  constructor(configKey: AgentName) {
    super();
    this.configKey = configKey;
    this.displayName = configKey;
  }

  getName(): string {
    return this.displayName;
  }

  getConfig(): AgentConfig | null {
    return AGENT_CONFIGS[this.configKey];
  }
}

export class AgentFactory {
  private static createConfigAgent(configKey: AgentName): BaseAgent | null {
    const agent = new ConfigBasedAgent(configKey);

    if (!agent.isAvailable()) {
      logger.warn(`[AgentFactory] Agent ${agent.getName()} not available (no model)`);
      return null;
    }

    return agent;
  }

  static create(type: AgentType): BaseAgent | null {
    const configKey = AGENT_TYPE_TO_CONFIG_KEY[type];
    if (!configKey) {
      logger.warn(`[AgentFactory] Unknown agent type: ${type}`);
      return null;
    }

    return AgentFactory.createConfigAgent(configKey);
  }

  static createByName(configKey: string): BaseAgent | null {
    if (!isAgentName(configKey)) {
      logger.warn(`[AgentFactory] Unknown config key: ${configKey}`);
      return null;
    }

    const type = CONFIG_KEY_TO_AGENT_TYPE[configKey];
    if (!type) {
      const config = getAgentConfig(configKey);
      if (!config) {
        logger.warn(`[AgentFactory] Unknown config key: ${configKey}`);
        return null;
      }

      return AgentFactory.createConfigAgent(configKey);
    }

    return AgentFactory.create(type);
  }

  static createByDomain(
    roleId: string,
    domain: AssistantDomain
  ): BaseAgent | null {
    const registry = domain.agentRoles;
    if (!registry) {
      return isAgentType(roleId) ? AgentFactory.create(roleId) : null;
    }

    const role = registry.resolveRole(roleId);
    if (!role) {
      logger.warn(`[AgentFactory] Unknown domain agent role: ${roleId}`);
      return null;
    }

    const runtimeConfigKey = role.runtimeConfigKey;
    if (!runtimeConfigKey) {
      logger.warn(
        `[AgentFactory] Domain agent role ${roleId} has no runtime config binding`
      );
      return null;
    }

    if (!isAgentName(runtimeConfigKey)) {
      logger.warn(
        `[AgentFactory] Unknown runtime config binding for role ${roleId}: ${runtimeConfigKey}`
      );
      return null;
    }

    return AgentFactory.createByName(runtimeConfigKey);
  }

  static getAvailableTypes(): AgentType[] {
    const available: AgentType[] = [];

    for (const type of Object.keys(AGENT_TYPE_TO_CONFIG_KEY) as AgentType[]) {
      const configKey = AGENT_TYPE_TO_CONFIG_KEY[type];
      const config = getAgentConfig(configKey);
      if (config && config.getModel() !== null) {
        available.push(type);
      }
    }

    return available;
  }

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
      const config = getAgentConfig(configKey);
      if (config) {
        status[type] = config.getModel() !== null;
      }
    }

    return status;
  }

  static isAvailable(type: AgentType): boolean {
    const configKey = AGENT_TYPE_TO_CONFIG_KEY[type];
    const config = getAgentConfig(configKey);
    if (!config) return false;
    return config.getModel() !== null;
  }
}

export async function runAgent(
  type: AgentType,
  query: string,
  options?: AgentRunOptions
): Promise<AgentResult | null> {
  const agent = AgentFactory.create(type);
  if (!agent) return null;
  return agent.run(query, options);
}

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

export { BaseAgent, AGENT_TYPE_TO_CONFIG_KEY, CONFIG_KEY_TO_AGENT_TYPE };
export type { AgentResult, AgentRunOptions, AgentStreamEvent };
