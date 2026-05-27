import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  shouldEnableVercelWebAnalytics,
  shouldEnableWebVitalsReporter,
} from './root-client-runtime-flags';

describe('shouldEnableWebVitalsReporter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('production에서는 항상 활성화한다', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WEB_VITALS', 'false');

    expect(shouldEnableWebVitalsReporter()).toBe(true);
  });

  it('development에서는 명시적 opt-in일 때만 활성화한다', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WEB_VITALS', 'true');

    expect(shouldEnableWebVitalsReporter()).toBe(true);
  });

  it('development 기본값은 비활성화다', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_WEB_VITALS', 'false');

    expect(shouldEnableWebVitalsReporter()).toBe(false);
  });
});

describe('shouldEnableVercelWebAnalytics', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('production 기본값은 비활성화해 Vercel 프로젝트 설정 미활성 시 404 스크립트를 요청하지 않는다', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_VERCEL_WEB_ANALYTICS', 'false');

    expect(shouldEnableVercelWebAnalytics()).toBe(false);
  });

  it('Vercel Web Analytics가 프로젝트에서 활성화된 경우 명시적으로 opt-in 한다', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_VERCEL_WEB_ANALYTICS', 'true');

    expect(shouldEnableVercelWebAnalytics()).toBe(true);
  });
});
