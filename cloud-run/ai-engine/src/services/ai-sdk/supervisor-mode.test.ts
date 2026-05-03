import { describe, expect, it } from 'vitest';
import {
  buildSupervisorAssistantPlan,
  buildSupervisorRouteDecision,
  resolveSupervisorMode,
  resolveSupervisorModeDecision,
} from './supervisor-mode';

describe('resolveSupervisorMode', () => {
  it('upgrades explicit single request to multi when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'single',
        messages: [{ role: 'user', content: '단순 상태 조회' }],
      }),
    ).toBe('multi');
  });

  it('keeps explicit single request when degraded single is allowed', () => {
    process.env.ALLOW_DEGRADED_SINGLE = 'true';
    expect(
      resolveSupervisorMode({
        mode: 'single',
        messages: [{ role: 'user', content: '단순 상태 조회' }],
      }),
    ).toBe('single');
    delete process.env.ALLOW_DEGRADED_SINGLE;
  });

  it('returns explicit mode without recalculating', () => {
    expect(
      resolveSupervisorMode({
        mode: 'multi',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toBe('multi');
  });

  it('resolves auto mode from the latest user message', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: '서버 상태 요약해줘' }],
      }),
    ).toBe('multi');
  });

  it('keeps low-complexity auto requests in single mode even when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toBe('single');
  });

  it('returns mode decision metadata for auto complexity routing', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;

    expect(
      resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toEqual({
      requestedMode: 'auto',
      resolvedMode: 'single',
      modeSelectionSource: 'auto_complexity',
      autoSelectedByComplexity: 'single',
    });
  });

  it('records explicit single upgrade decisions when degraded single is disallowed', () => {
    delete process.env.ALLOW_DEGRADED_SINGLE;

    expect(
      resolveSupervisorModeDecision({
        mode: 'single',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toEqual({
      requestedMode: 'single',
      resolvedMode: 'multi',
      modeSelectionSource: 'single_disallowed_upgrade',
    });
  });

  it('defaults to multi when no user message exists', () => {
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'assistant', content: '안녕하세요' }],
      }),
    ).toBe('multi');
  });

  it('biases infra queries to multi in thinking mode', () => {
    expect(
      resolveSupervisorModeDecision({
        mode: 'auto',
        analysisMode: 'thinking',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toEqual({
      requestedMode: 'auto',
      resolvedMode: 'multi',
      modeSelectionSource: 'analysis_mode_thinking',
      autoSelectedByComplexity: 'multi',
      analysisMode: 'thinking',
    });
  });

  it.each([
    {
      label: 'simple metric lookup',
      query: 'CPU 알려줘',
      resolvedMode: 'single',
      executionMode: 'single-agent',
    },
    {
      label: 'RCA/report escalation candidate',
      query: '전체 서버 장애 원인 분석 보고서 만들어줘',
      resolvedMode: 'multi',
      executionMode: 'multi-agent',
    },
  ])(
    'pins current Cloud Run supervisor baseline for $label',
    ({ query, resolvedMode, executionMode }) => {
      delete process.env.ALLOW_DEGRADED_SINGLE;

      const decision = resolveSupervisorModeDecision({
        mode: 'auto',
        messages: [{ role: 'user', content: query }],
      });
      const routeDecision = buildSupervisorRouteDecision(decision, {
        traceId: 'trace-m5a-baseline',
        queryAsOf: {
          dataSlot: {
            slotIndex: 131,
            minuteOfDay: 1310,
            timeLabel: '21:50 KST',
          },
        },
      });

      expect(decision.resolvedMode).toBe(resolvedMode);
      expect(buildSupervisorAssistantPlan(routeDecision)).toMatchObject({
        kind: 'chat',
        executionPath: 'stream',
        executionMode,
        stream: true,
        job: false,
        decidedBy: 'cloud-run',
        routeDecision: expect.objectContaining({
          intent: 'chat',
          executionPath: 'stream',
          mode: resolvedMode,
          traceId: 'trace-m5a-baseline',
          dataSlot: '21:50 KST',
        }),
      });
    }
  );
});
