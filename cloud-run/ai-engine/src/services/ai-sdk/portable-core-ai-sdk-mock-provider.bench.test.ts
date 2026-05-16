import { generateText, simulateReadableStream, streamText } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { buildAgentLoopSettings } from './agents/config/agent-loop-settings';
import {
  buildSupervisorAssistantPlanForRequest,
  buildSupervisorRouteDecision,
  resolveSupervisorModeDecision,
} from './supervisor-mode';
import type { SupervisorRequest } from './supervisor-types';

const MOCK_USAGE = {
  inputTokens: {
    total: 7,
    noCache: 7,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 5,
    text: 5,
    reasoning: undefined,
  },
};

function buildRequest(query: string): SupervisorRequest {
  return {
    sessionId: `mock-provider-bench-${query.length}`,
    mode: 'auto',
    messages: [{ role: 'user', content: query }],
    traceId: `trace-mock-provider-bench-${query.length}`,
  };
}

function buildTextMockModel(text: string) {
  return new MockLanguageModelV3({
    provider: 'mock-openmanager',
    modelId: 'mock-path-parity',
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: MOCK_USAGE,
      warnings: [],
    }),
  });
}

function buildStreamMockModel(chunks: string[]) {
  return new MockLanguageModelV3({
    provider: 'mock-openmanager',
    modelId: 'mock-path-parity',
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 'text-1' },
          ...chunks.map((delta) => ({
            type: 'text-delta' as const,
            id: 'text-1',
            delta,
          })),
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            logprobs: undefined,
            usage: MOCK_USAGE,
          },
        ],
      }),
    }),
  });
}

function buildRouteSnapshot(query: string) {
  const request = buildRequest(query);
  const modeDecision = resolveSupervisorModeDecision(request);
  const routeDecision = buildSupervisorRouteDecision(modeDecision, {
    traceId: request.traceId,
  });
  const assistantPlan = buildSupervisorAssistantPlanForRequest(
    request,
    routeDecision
  );

  return {
    resolvedMode: modeDecision.resolvedMode,
    executionMode: assistantPlan.executionMode,
    executionPath: assistantPlan.plannerShadow?.candidate.executionPath,
    reasonCodes: assistantPlan.plannerShadow?.candidate.reasonCodes,
    escalationReasonCodes:
      assistantPlan.plannerShadow?.candidate.escalationReasonCodes,
  };
}

describe('AI SDK mock provider path parity benchmark', () => {
  it('keeps route selection deterministic without provider calls', () => {
    expect([
      buildRouteSnapshot('api-was-dc1-01 CPU 알려줘'),
      buildRouteSnapshot('전체 서버 장애 원인 분석 보고서 만들어줘'),
    ]).toEqual([
      {
        resolvedMode: 'single',
        executionMode: 'single-agent',
        executionPath: 'stream',
        reasonCodes: ['metric_lookup'],
        escalationReasonCodes: undefined,
      },
      {
        resolvedMode: 'multi',
        executionMode: 'multi-agent',
        executionPath: 'job',
        reasonCodes: ['incident_report'],
        escalationReasonCodes: ['incident_report_requested'],
      },
    ]);
  });

  it('uses the same policy ceilings for mock generateText and streamText without retry amplification', async () => {
    const generatePolicy = buildAgentLoopSettings(
      'Metrics Query Agent',
      'forced-routing'
    );
    const streamPolicy = buildAgentLoopSettings(
      'Metrics Query Agent',
      'agent-stream'
    );
    const generateModel = buildTextMockModel('api-01 CPU는 42%입니다.');
    const streamModel = buildStreamMockModel(['api-01 ', 'CPU는 42%입니다.']);

    const generated = await generateText({
      model: generateModel,
      prompt: 'api-01 CPU 알려줘',
      stopWhen: generatePolicy.stopWhen,
      maxOutputTokens: generatePolicy.maxOutputTokens,
      maxRetries: generatePolicy.sdkMaxRetries,
    });
    const streamed = streamText({
      model: streamModel,
      prompt: 'api-01 CPU 알려줘',
      stopWhen: streamPolicy.stopWhen,
      maxOutputTokens: streamPolicy.maxOutputTokens,
      maxRetries: streamPolicy.sdkMaxRetries,
    });

    let streamedText = '';
    for await (const delta of streamed.textStream) {
      streamedText += delta;
    }

    expect({
      generatedText: generated.text,
      streamedText,
      generateCalls: generateModel.doGenerateCalls.length,
      streamCalls: streamModel.doStreamCalls.length,
      generateMaxOutputTokens:
        generateModel.doGenerateCalls[0]?.maxOutputTokens,
      streamMaxOutputTokens: streamModel.doStreamCalls[0]?.maxOutputTokens,
      generatePolicy: {
        maxSteps: generatePolicy.maxSteps,
        maxOutputTokens: generatePolicy.maxOutputTokens,
        sdkMaxRetries: generatePolicy.sdkMaxRetries,
      },
      streamPolicy: {
        maxSteps: streamPolicy.maxSteps,
        maxOutputTokens: streamPolicy.maxOutputTokens,
        sdkMaxRetries: streamPolicy.sdkMaxRetries,
      },
    }).toEqual({
      generatedText: 'api-01 CPU는 42%입니다.',
      streamedText: 'api-01 CPU는 42%입니다.',
      generateCalls: 1,
      streamCalls: 1,
      generateMaxOutputTokens: 2048,
      streamMaxOutputTokens: 2048,
      generatePolicy: {
        maxSteps: 4,
        maxOutputTokens: 2048,
        sdkMaxRetries: 0,
      },
      streamPolicy: {
        maxSteps: 4,
        maxOutputTokens: 2048,
        sdkMaxRetries: 0,
      },
    });
  });
});
