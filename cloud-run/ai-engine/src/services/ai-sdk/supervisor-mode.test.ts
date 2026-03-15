import { describe, expect, it } from 'vitest';
import { resolveSupervisorMode } from './supervisor-mode';

describe('resolveSupervisorMode', () => {
  it('returns explicit mode without recalculating', () => {
    expect(
      resolveSupervisorMode({
        mode: 'multi',
        messages: [{ role: 'user', content: 'CPU 알려줘' }],
      }),
    ).toBe('multi');
  });

  it('resolves auto mode from the latest user message', () => {
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'user', content: '서버 상태 요약해줘' }],
      }),
    ).toBe('multi');
  });

  it('defaults to single when no user message exists', () => {
    expect(
      resolveSupervisorMode({
        mode: 'auto',
        messages: [{ role: 'assistant', content: '안녕하세요' }],
      }),
    ).toBe('single');
  });
});
