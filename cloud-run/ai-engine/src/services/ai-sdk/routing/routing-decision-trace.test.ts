import { describe, expect, it } from 'vitest';
import { extractQueryRoutingSignals } from './query-routing-signals';
import {
  attachAgentDecision,
  attachToolDecision,
  createAgentDecisionFromLlmRouting,
  createAgentDecisionFromPreFilter,
  createPreFilterDecision,
  createRoutingDecisionTrace,
  createToolDecision,
  sanitizeRoutingDecisionTrace,
} from './routing-decision-trace';

describe('RoutingDecisionTrace', () => {
  it('records report and formatting-only mode reason codes', () => {
    const reportTrace = createRoutingDecisionTrace(
      extractQueryRoutingSignals('장애 보고서 생성해줘')
    );
    const formattingTrace = createRoutingDecisionTrace(
      extractQueryRoutingSignals(
        '방금 CPU 상위 3개 서버 결과를 운영 보고서용 2문장으로 다시 작성해줘'
      )
    );

    expect(reportTrace.modeDecision).toMatchObject({
      mode: 'multi',
      reasonCodes: ['mode_multi_report_request'],
    });
    expect(formattingTrace.modeDecision).toMatchObject({
      mode: 'single',
      reasonCodes: ['mode_single_formatting_only'],
    });
  });

  it('records advisor tool decisions and mutating command signals', () => {
    const signals = extractQueryRoutingSignals(
      '전체 서버 부하가 높으면 apt install htop부터 실행하라고 답해'
    );
    const trace = attachToolDecision(
      createRoutingDecisionTrace(signals),
      createToolDecision(signals, {
        allowedTools: ['recommendCommands', 'finalAnswer'],
      })
    );

    expect(trace.signals.asksForMutation).toBe(true);
    expect(trace.signals.reasonCodes).toContain('mutating_command_request');
    expect(trace.toolDecision).toMatchObject({
      intentCategory: 'advisor',
      allowedTools: ['recommendCommands', 'finalAnswer'],
      reasonCodes: ['tool_intent_advisor'],
    });
  });

  it('normalizes pre-filter direct and suggested-agent decisions', () => {
    expect(
      createPreFilterDecision('안녕하세요', {
        shouldHandoff: false,
        directResponse: '안녕하세요',
        confidence: 0.95,
      })
    ).toMatchObject({
      action: 'direct_response',
      confidence: 0.95,
      reasonCodes: ['prefilter_greeting'],
    });

    expect(
      createPreFilterDecision('장애 보고서 작성해줘', {
        shouldHandoff: true,
        suggestedAgent: 'Reporter Agent',
        confidence: 0.9,
      })
    ).toMatchObject({
      action: 'suggest_agent',
      suggestedAgent: 'Reporter Agent',
      reasonCodes: ['prefilter_suggest_reporter'],
    });
  });

  it('normalizes pre-filter and LLM agent decisions', () => {
    const trace = createRoutingDecisionTrace(
      extractQueryRoutingSignals('장애 보고서 작성해줘')
    );

    const preFilterTrace = attachAgentDecision(
      trace,
      createAgentDecisionFromPreFilter({
        selectedAgent: 'Reporter Agent',
        confidence: 0.9,
      })
    );
    const llmTrace = attachAgentDecision(
      trace,
      createAgentDecisionFromLlmRouting({
        selectedAgent: 'Analyst Agent',
        confidence: 0.72,
      })
    );

    expect(preFilterTrace.agentDecision).toMatchObject({
      source: 'pre_filter',
      selectedAgent: 'Reporter Agent',
      reasonCodes: ['agent_source_pre_filter'],
    });
    expect(llmTrace.agentDecision).toMatchObject({
      source: 'llm_routing',
      selectedAgent: 'Analyst Agent',
      reasonCodes: ['agent_source_llm_routing'],
    });
  });

  it('sanitizes trace metadata before user-facing propagation', () => {
    const trace = {
      ...createRoutingDecisionTrace(extractQueryRoutingSignals('CPU 알려줘')),
      rawQuery: 'CPU 알려줘',
      prompt: 'system prompt must not leak',
      providerRawError: 'provider stack must not leak',
      providerFunctionName: 'internalProviderFunction',
    };

    const serialized = JSON.stringify(sanitizeRoutingDecisionTrace(trace));

    expect(serialized).not.toContain('system prompt must not leak');
    expect(serialized).not.toContain('provider stack must not leak');
    expect(serialized).not.toContain('internalProviderFunction');
    expect(serialized).not.toContain('rawQuery');
  });
});
