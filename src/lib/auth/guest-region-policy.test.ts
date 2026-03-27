import { afterEach, describe, expect, it } from 'vitest';
import {
  getRequestCountryCode,
  isGuestCountryBlocked,
} from './guest-region-policy';

describe('guest-region-policy', () => {
  const originalBlocked = process.env.GUEST_LOGIN_BLOCKED_COUNTRIES;

  afterEach(() => {
    process.env.GUEST_LOGIN_BLOCKED_COUNTRIES = originalBlocked;
  });

  it('x-vercel-ip-country 헤더에서 국가 코드를 추출한다', () => {
    const headers = new Headers({
      'x-vercel-ip-country': 'kr',
    });

    expect(getRequestCountryCode(headers)).toBe('KR');
  });

  it('국가 헤더가 없으면 null을 반환한다', () => {
    expect(getRequestCountryCode(new Headers())).toBeNull();
  });

  it('기본 정책에서 CN은 차단한다', () => {
    delete process.env.GUEST_LOGIN_BLOCKED_COUNTRIES;
    expect(isGuestCountryBlocked('CN')).toBe(true);
  });

  it('환경변수 정책으로 차단 국가를 확장할 수 있다', () => {
    process.env.GUEST_LOGIN_BLOCKED_COUNTRIES = 'CN,RU';

    expect(isGuestCountryBlocked('RU')).toBe(true);
    expect(isGuestCountryBlocked('KR')).toBe(false);
  });
});
