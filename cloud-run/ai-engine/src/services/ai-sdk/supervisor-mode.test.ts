import { describe, expect, it } from 'vitest';
import {
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
});
