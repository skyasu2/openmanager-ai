import { describe, expect, it } from 'vitest';
import {
  buildAgentLoopSettings,
  toAgentLoopTelemetry,
} from './agent-loop-settings';

describe('agent loop settings', () => {
  it('maps forced routing to AI SDK Core generateText loop settings', () => {
    const settings = buildAgentLoopSettings(
      'Metrics Query Agent',
      'forced-routing'
    );

    expect(settings).toMatchObject({
      implementation: 'core-generate-text',
      maxSteps: 4,
      maxOutputTokens: 2048,
      sdkMaxRetries: 0,
    });
    expect(settings.stopWhen).toHaveLength(2);
  });

  it('keeps agent stream loop settings aligned with runtime policy', () => {
    const settings = buildAgentLoopSettings('Analyst Agent', 'agent-stream');

    expect(settings).toMatchObject({
      implementation: 'core-stream-text',
      maxSteps: 5,
      maxOutputTokens: 2048,
      sdkMaxRetries: 0,
    });
    expect(settings.stopWhen).toHaveLength(2);
  });

  it('maps BaseAgent direct runs to ToolLoopAgent settings', () => {
    const settings = buildAgentLoopSettings('Vision Agent', 'tool-loop-agent');

    expect(settings).toMatchObject({
      implementation: 'tool-loop-agent',
      maxSteps: 2,
      maxOutputTokens: 2048,
      sdkMaxRetries: 1,
    });
    expect(settings.stopWhen).toHaveLength(2);
  });

  it('serializes telemetry without leaking stopWhen functions', () => {
    const settings = buildAgentLoopSettings('Reporter Agent', 'agent-stream');

    expect(toAgentLoopTelemetry(settings, 3)).toEqual({
      implementation: 'core-stream-text',
      maxSteps: 4,
      maxOutputTokens: 2048,
      sdkMaxRetries: 0,
      stepsExecuted: 3,
    });
  });
});
