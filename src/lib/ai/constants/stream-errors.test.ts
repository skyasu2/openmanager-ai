import { describe, expect, it } from 'vitest';
import {
  isAuthRelatedError,
  isBlockedInputError,
  sanitizeDisplayedErrorMessage,
} from './stream-errors';

describe('isBlockedInputError', () => {
  it('detects blocked input from json envelope', () => {
    const error =
      '{"success":false,"error":"Security: blocked input","message":"보안 정책에 의해 차단된 요청입니다."}';

    expect(isBlockedInputError(error)).toBe(true);
  });

  it('returns false for regular network errors', () => {
    expect(isBlockedInputError('fetch failed')).toBe(false);
  });
});

describe('sanitizeDisplayedErrorMessage', () => {
  it('returns a friendly message for blocked input json', () => {
    const error =
      '{"success":false,"error":"Security: blocked input","message":"보안 정책에 의해 차단된 요청입니다."}';

    expect(sanitizeDisplayedErrorMessage(error)).toBe(
      '입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다. 다른 표현으로 다시 시도해주세요.'
    );
  });

  it('hides raw json envelopes for generic backend errors', () => {
    const error =
      '{"success":false,"error":"Internal server error","message":"some internal message"}';

    expect(sanitizeDisplayedErrorMessage(error)).toBe(
      '요청을 처리하는 중 오류가 발생했습니다.'
    );
  });

  it('keeps plain-text errors unchanged', () => {
    expect(sanitizeDisplayedErrorMessage('fetch failed')).toBe('fetch failed');
  });
});

describe('isAuthRelatedError', () => {
  it('detects login-required errors', () => {
    expect(
      isAuthRelatedError('401 Unauthorized: auth_proof validation failed')
    ).toBe(true);
  });

  it('does not flag generic backend failures as auth errors', () => {
    expect(isAuthRelatedError('Stream error: upstream timeout')).toBe(false);
  });
});
