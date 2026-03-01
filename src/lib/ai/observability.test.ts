import { describe, expect, it, vi } from 'vitest';
import { logAIRequest, logAIResponse, startAITimer } from './observability';

// Mock the logger module
vi.mock('@/lib/logging', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('LLM Observability', () => {
  it('logAIRequest가 에러 없이 호출된다', () => {
    expect(() =>
      logAIRequest({
        operation: 'chat',
        system: 'groq',
        model: 'llama-3.3-70b-versatile',
        agent: 'nlq',
        sessionId: 'test_session',
        traceId: 'trace_123',
        querySummary: '서버 CPU 사용률 확인',
      })
    ).not.toThrow();
  });

  it('logAIResponse가 성공 응답을 로깅한다', () => {
    expect(() =>
      logAIResponse({
        operation: 'chat',
        system: 'groq',
        model: 'llama-3.3-70b-versatile',
        inputTokens: 1200,
        outputTokens: 450,
        latencyMs: 2340,
        success: true,
        agent: 'nlq',
        traceId: 'trace_123',
      })
    ).not.toThrow();
  });

  it('logAIResponse가 실패 응답을 로깅한다', () => {
    expect(() =>
      logAIResponse({
        operation: 'chat',
        system: 'cerebras',
        model: 'gpt-oss-120b',
        latencyMs: 30000,
        success: false,
        errorMessage: 'Timeout after 30s',
        agent: 'analyst',
      })
    ).not.toThrow();
  });

  it('startAITimer가 경과 시간을 반환한다', () => {
    const timer = startAITimer();
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(typeof elapsed).toBe('number');
  });

  it('logAIRequest가 선택적 필드 없이도 동작한다', () => {
    expect(() =>
      logAIRequest({
        operation: 'completion',
        system: 'mistral',
        model: 'mistral-large-latest',
      })
    ).not.toThrow();
  });

  it('logAIResponse가 캐시 히트를 로깅한다', () => {
    expect(() =>
      logAIResponse({
        operation: 'chat',
        system: 'cache',
        model: 'cached',
        latencyMs: 5,
        success: true,
        cacheHit: true,
      })
    ).not.toThrow();
  });
});
