import { getTrimmedEnv } from './env';

export type RequiredCloudRunConfigFailureCode =
  | 'disabled'
  | 'missing_url'
  | 'missing_api_secret';

export type RequiredCloudRunConfigResult =
  | {
      ok: true;
      url: string;
      apiSecret: string;
    }
  | {
      ok: false;
      code: RequiredCloudRunConfigFailureCode;
      message: string;
    };

interface RequiredCloudRunConfigOptions {
  requireApiSecret?: boolean;
}

export function getRequiredCloudRunConfig(
  options: RequiredCloudRunConfigOptions = {}
): RequiredCloudRunConfigResult {
  const requireApiSecret = options.requireApiSecret ?? true;
  const enabled = getTrimmedEnv('CLOUD_RUN_ENABLED') === 'true';
  const url = getTrimmedEnv('CLOUD_RUN_AI_URL');
  const apiSecret = getTrimmedEnv('CLOUD_RUN_API_SECRET');

  if (!enabled) {
    return {
      ok: false,
      code: 'disabled',
      message: 'CLOUD_RUN_ENABLED is not true',
    };
  }

  if (!url) {
    return {
      ok: false,
      code: 'missing_url',
      message: 'CLOUD_RUN_AI_URL is not configured',
    };
  }

  if (requireApiSecret && !apiSecret) {
    return {
      ok: false,
      code: 'missing_api_secret',
      message: 'CLOUD_RUN_API_SECRET is not configured',
    };
  }

  return { ok: true, url, apiSecret };
}
