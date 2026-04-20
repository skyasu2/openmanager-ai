import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldEnableWebVitalsReporter } from './root-client-runtime-flags';

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
