import { afterEach, describe, expect, it } from 'vitest';
import { getRequiredCloudRunConfig } from './cloud-run-config';

const originalEnabled = process.env.CLOUD_RUN_ENABLED;
const originalUrl = process.env.CLOUD_RUN_AI_URL;
const originalSecret = process.env.CLOUD_RUN_API_SECRET;

afterEach(() => {
  process.env.CLOUD_RUN_ENABLED = originalEnabled;
  process.env.CLOUD_RUN_AI_URL = originalUrl;
  process.env.CLOUD_RUN_API_SECRET = originalSecret;
});

describe('getRequiredCloudRunConfig', () => {
  it('enabled=false면 url/secret이 있어도 not ready를 반환한다', () => {
    process.env.CLOUD_RUN_ENABLED = 'false';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';

    expect(getRequiredCloudRunConfig()).toEqual({
      ok: false,
      code: 'disabled',
      message: 'CLOUD_RUN_ENABLED is not true',
    });
  });

  it('공백 url/secret은 미설정으로 처리한다', () => {
    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.CLOUD_RUN_AI_URL = '   ';
    process.env.CLOUD_RUN_API_SECRET = '   ';

    expect(getRequiredCloudRunConfig()).toEqual({
      ok: false,
      code: 'missing_url',
      message: 'CLOUD_RUN_AI_URL is not configured',
    });
  });

  it('enabled/url/secret이 모두 유효하면 ready를 반환한다', () => {
    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.CLOUD_RUN_AI_URL = ' https://example-ai.run.app ';
    process.env.CLOUD_RUN_API_SECRET = ' test-secret ';

    expect(getRequiredCloudRunConfig()).toEqual({
      ok: true,
      url: 'https://example-ai.run.app',
      apiSecret: 'test-secret',
    });
  });

  it('requireApiSecret=false면 secret 없이도 ready를 반환한다', () => {
    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    delete process.env.CLOUD_RUN_API_SECRET;

    expect(getRequiredCloudRunConfig({ requireApiSecret: false })).toEqual({
      ok: true,
      url: 'https://example-ai.run.app',
      apiSecret: '',
    });
  });
});
