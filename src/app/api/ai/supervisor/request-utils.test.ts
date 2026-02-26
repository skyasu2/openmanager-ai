import { describe, expect, it, vi } from 'vitest';

// security mock — securityCheck를 제어하기 위해
vi.mock('./security', () => ({
  securityCheck: vi.fn((input: string) => ({
    sanitizedInput: input.trim(),
    shouldBlock: false,
    inputCheck: { blocked: false, reasons: [] },
    warning: undefined,
  })),
}));

import { extractAndValidateQuery, resolveSessionId } from './request-utils';
import { securityCheck } from './security';

// ---------- resolveSessionId ----------

describe('resolveSessionId', () => {
  function makeReq(opts: {
    header?: string;
    query?: string;
  }): Parameters<typeof resolveSessionId>[0] {
    const url = new URL('https://example.com/api/ai/supervisor');
    if (opts.query) url.searchParams.set('sessionId', opts.query);
    return {
      url: url.toString(),
      headers: {
        get: (k: string) =>
          k === 'X-Session-Id' ? (opts.header ?? null) : null,
      },
    } as never;
  }

  it('Header > Body > Query > Fallback 우선순위로 반환한다', () => {
    expect(resolveSessionId(makeReq({ header: 'h' }), 'b', 'f')).toBe('h');
    expect(resolveSessionId(makeReq({}), 'b', 'f')).toBe('b');
    expect(resolveSessionId(makeReq({ query: 'q' }), undefined, 'f')).toBe('q');
    expect(resolveSessionId(makeReq({}), undefined, 'f')).toBe('f');
  });

  it('모든 값이 없으면 빈 문자열을 반환한다', () => {
    expect(resolveSessionId(makeReq({}), undefined, undefined)).toBe('');
  });

  it('Header가 있으면 Body/Query를 무시한다', () => {
    expect(
      resolveSessionId(makeReq({ header: 'h', query: 'q' }), 'b', 'f')
    ).toBe('h');
  });
});

// ---------- extractAndValidateQuery ----------

describe('extractAndValidateQuery', () => {
  it('빈 메시지 배열이면 empty_query를 반환한다', () => {
    const result = extractAndValidateQuery([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty_query');
  });

  it('user 메시지만 공백이면 empty_query를 반환한다', () => {
    const result = extractAndValidateQuery([{ role: 'user', content: '   ' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty_query');
  });

  it('정상 쿼리를 추출하고 ok: true를 반환한다', () => {
    const result = extractAndValidateQuery([
      { role: 'user', content: '서버 상태 알려줘' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userQuery).toBe('서버 상태 알려줘');
      expect(result.inputCheck).toBeDefined();
    }
  });

  it('securityCheck가 block하면 reason=blocked를 반환한다', () => {
    vi.mocked(securityCheck).mockReturnValueOnce({
      sanitizedInput: '',
      shouldBlock: true,
      inputCheck: { blocked: true, reasons: ['injection'] } as never,
      warning: 'Blocked',
    });

    const result = extractAndValidateQuery([
      { role: 'user', content: 'DROP TABLE users' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('blocked');
      expect(result.warning).toBe('Blocked');
    }
  });

  it('여러 메시지 중 마지막 user 메시지를 사용한다', () => {
    const result = extractAndValidateQuery([
      { role: 'user', content: '첫 번째 질문' },
      { role: 'assistant', content: '응답' },
      { role: 'user', content: '두 번째 질문' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.userQuery).toBe('두 번째 질문');
  });
});
