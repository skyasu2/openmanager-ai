/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  API_CSP,
  CSP_PRESETS,
  checkCSPSupport,
  generateCSPNonce,
  generateCSPString,
  generateSecurityHeaders,
  getAdminCSP,
  getCSPReportDirective,
} from './csp-utils';

describe('generateCSPNonce', () => {
  it('Base64 인코딩된 nonce 문자열을 반환한다', () => {
    // When
    const nonce = generateCSPNonce();

    // Then: Base64 문자열 (A-Za-z0-9+/=)
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(nonce.length).toBeGreaterThan(0);
  });

  it('호출할 때마다 고유한 값을 생성한다', () => {
    // When
    const nonces = Array.from({ length: 10 }, () => generateCSPNonce());
    const unique = new Set(nonces);

    // Then: 10개 모두 고유
    expect(unique.size).toBe(10);
  });
});

describe('generateCSPString', () => {
  it('프로덕션 환경 CSP에 unsafe-eval을 포함하지 않는다', () => {
    // When: 프로덕션 환경 (isDev=false)
    const csp = generateCSPString(false);

    // Then
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('개발 환경에서 unsafe-eval을 허용한다', () => {
    // When: 개발 환경 (isDev=true)
    const csp = generateCSPString(true);

    // Then
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('개발 환경에서 localhost WebSocket을 허용한다', () => {
    // When
    const csp = generateCSPString(true);

    // Then
    expect(csp).toContain('ws://localhost:3000');
    expect(csp).toContain('http://localhost:3000');
  });

  it('nonce가 제공되면 script-src에 포함한다', () => {
    // Given
    const nonce = 'test-nonce-123';

    // When
    const csp = generateCSPString(false, false, nonce);

    // Then
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('nonce가 없으면 nonce 지시어를 포함하지 않는다', () => {
    // When
    const csp = generateCSPString(false);

    // Then
    expect(csp).not.toContain('nonce-');
  });

  it('필수 보안 지시어가 모두 포함된다', () => {
    // When
    const csp = generateCSPString(false);

    // Then
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe('getAdminCSP', () => {
  it('기본 CSP에 trusted-types 요구사항을 추가한다', () => {
    // Given
    const baseCSP = "default-src 'self'";

    // When
    const adminCSP = getAdminCSP(baseCSP);

    // Then
    expect(adminCSP).toContain(baseCSP);
    expect(adminCSP).toContain("require-trusted-types-for 'script'");
  });
});

describe('getCSPReportDirective', () => {
  it('reportUri가 없으면 빈 문자열을 반환한다', () => {
    // When/Then
    expect(getCSPReportDirective()).toBe('');
    expect(getCSPReportDirective(undefined)).toBe('');
  });

  it('reportUri가 있으면 report-uri와 report-to 지시어를 반환한다', () => {
    // Given
    const uri = 'https://example.com/csp-report';

    // When
    const directive = getCSPReportDirective(uri);

    // Then
    expect(directive).toContain(`report-uri ${uri}`);
    expect(directive).toContain('report-to csp-endpoint');
  });
});

describe('checkCSPSupport', () => {
  it('User-Agent 없이 기본 지원 정보를 반환한다', () => {
    // When
    const support = checkCSPSupport();

    // Then
    expect(support.supportsCSP).toBe(true);
    expect(support.supportsNonce).toBe(true);
    expect(support.supportsTrustedTypes).toBe(false);
  });

  it('Chrome 83+에서 Trusted Types를 지원한다', () => {
    // When
    const support = checkCSPSupport(
      'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'
    );

    // Then
    expect(support.supportsTrustedTypes).toBe(true);
  });

  it('Chrome 82 이하에서 Trusted Types를 미지원한다', () => {
    // When
    const support = checkCSPSupport(
      'Mozilla/5.0 Chrome/82.0.0.0 Safari/537.36'
    );

    // Then
    expect(support.supportsTrustedTypes).toBe(false);
  });

  it('Firefox에서 Trusted Types를 미지원한다', () => {
    // When
    const support = checkCSPSupport('Mozilla/5.0 Firefox/120.0');

    // Then
    expect(support.supportsTrustedTypes).toBe(false);
  });
});

describe('generateSecurityHeaders', () => {
  it('기본 보안 헤더를 모두 포함한다', () => {
    // When
    const headers = generateSecurityHeaders();

    // Then
    expect(headers['Content-Security-Policy']).toBeTruthy();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('Vercel 환경에서 HSTS 헤더를 추가한다', () => {
    // When
    const headers = generateSecurityHeaders({ isVercel: true });

    // Then
    expect(headers['Strict-Transport-Security']).toContain('max-age=');
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('비-Vercel 환경에서 HSTS 헤더를 포함하지 않는다', () => {
    // When
    const headers = generateSecurityHeaders({ isVercel: false });

    // Then
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('customCSP가 제공되면 자동 생성 대신 사용한다', () => {
    // Given
    const customCSP = "default-src 'none'";

    // When
    const headers = generateSecurityHeaders({ customCSP });

    // Then
    expect(headers['Content-Security-Policy']).toBe(customCSP);
  });
});

describe('상수', () => {
  it('API_CSP는 script/object/frame을 차단한다', () => {
    // Then
    expect(API_CSP).toContain("script-src 'none'");
    expect(API_CSP).toContain("object-src 'none'");
    expect(API_CSP).toContain("frame-src 'none'");
  });

  it('CSP_PRESETS에 development/production/strict 프리셋이 있다', () => {
    // Then
    expect(CSP_PRESETS.development).toBeDefined();
    expect(CSP_PRESETS.production).toBeDefined();
    expect(CSP_PRESETS.strict).toBeDefined();
  });

  it('strict 프리셋은 self만 허용한다', () => {
    // Then
    expect(CSP_PRESETS.strict['script-src']).toBe("'self'");
    expect(CSP_PRESETS.strict['object-src']).toBe("'none'");
  });
});
