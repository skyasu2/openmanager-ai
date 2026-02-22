import { afterEach, describe, expect, it } from 'vitest';
import {
  getClientIpFromHeaders,
  isGuestChinaIpRangeBlocked,
} from './guest-ip-policy';

describe('guest-ip-policy', () => {
  const originalCidrs = process.env.GUEST_CN_IP_CIDRS;

  afterEach(() => {
    process.env.GUEST_CN_IP_CIDRS = originalCidrs;
  });

  it('x-forwarded-for 첫 번째 IPv4를 추출한다', () => {
    const headers = new Headers({
      'x-forwarded-for': '1.2.3.4, 5.6.7.8',
    });

    expect(getClientIpFromHeaders(headers)).toBe('1.2.3.4');
  });

  it('CIDR 목록에 포함된 IP를 차단한다', () => {
    process.env.GUEST_CN_IP_CIDRS = '1.2.3.0/24';

    const result = isGuestChinaIpRangeBlocked(
      new Headers({ 'x-forwarded-for': '1.2.3.55' })
    );

    expect(result.blocked).toBe(true);
    expect(result.clientIp).toBe('1.2.3.55');
  });

  it('CIDR 목록에 없으면 차단하지 않는다', () => {
    process.env.GUEST_CN_IP_CIDRS = '1.2.3.0/24';

    const result = isGuestChinaIpRangeBlocked(
      new Headers({ 'x-forwarded-for': '8.8.8.8' })
    );

    expect(result.blocked).toBe(false);
    expect(result.clientIp).toBe('8.8.8.8');
  });
});
