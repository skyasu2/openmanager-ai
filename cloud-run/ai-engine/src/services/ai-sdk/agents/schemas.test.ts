import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  anomalySchema,
  getAgentFromRouting,
  isValidAgentName,
  routingSchema,
  taskDecomposeSchema,
} from './schemas';

describe('agent structured schemas zod v4 compatibility', () => {
  it('uses a zod v4 runtime for structured output schemas', () => {
    const zodRuntime = z as unknown as {
      url?: unknown;
      email?: unknown;
      uuid?: unknown;
    };

    expect(zodRuntime.url).toBeTypeOf('function');
    expect(zodRuntime.email).toBeTypeOf('function');
    expect(zodRuntime.uuid).toBeTypeOf('function');
  });

  it('preserves routing schema validation and NONE fallback behavior', () => {
    const decision = routingSchema.parse({
      selectedAgent: 'NONE',
      confidence: 0.1,
      reasoning: 'No operational intent',
    });

    expect(getAgentFromRouting(decision)).toBeNull();
    expect(isValidAgentName('Analyst Agent')).toBe(true);
    expect(isValidAgentName('Unknown Agent')).toBe(false);
  });

  it('preserves nested schema validation for task and anomaly outputs', () => {
    expect(
      taskDecomposeSchema.parse({
        subtasks: [
          {
            task: 'CPU 경고 서버 확인',
            agent: 'Analyst Agent',
            priority: 1,
          },
        ],
        requiresSequential: false,
        unificationStrategy: 'summarize',
      })
    ).toMatchObject({ requiresSequential: false });

    expect(() =>
      anomalySchema.parse({
        detected: true,
        severity: 'urgent',
        affectedServers: [],
        summary: 'invalid severity',
      })
    ).toThrow();
  });
});
