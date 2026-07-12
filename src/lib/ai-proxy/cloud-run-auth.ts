import { getVercelOidcToken } from '@vercel/oidc';
import { getTrimmedEnv } from './env';

const GOOGLE_STS_URL = 'https://sts.googleapis.com/v1/token';
const GOOGLE_IAM_CREDENTIALS_BASE =
  'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts';
const TOKEN_EXCHANGE_TIMEOUT_MS = 5_000;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1_000;
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

interface CloudRunIamConfig {
  projectNumber: string;
  serviceAccountEmail: string;
  workloadIdentityPoolId: string;
  workloadIdentityPoolProviderId: string;
}

interface CachedGoogleIdToken {
  key: string;
  token: string;
  expiresAtMs: number;
}

interface InFlightGoogleIdToken {
  key: string;
  promise: Promise<string>;
}

interface CreateCloudRunAuthHeadersInput {
  apiSecret: string;
  serviceUrl: string;
}

let cachedGoogleIdToken: CachedGoogleIdToken | undefined;
let inFlightGoogleIdToken: InFlightGoogleIdToken | undefined;

function readRequiredEnv(name: string): string {
  const value = getTrimmedEnv(name);
  if (!value) {
    throw new Error(
      `[CloudRunIAM] ${name} is required when IAM auth is enabled.`
    );
  }
  return value;
}

function readCloudRunIamConfig(): CloudRunIamConfig {
  return {
    projectNumber: readRequiredEnv('GCP_PROJECT_NUMBER'),
    serviceAccountEmail: readRequiredEnv('GCP_SERVICE_ACCOUNT_EMAIL'),
    workloadIdentityPoolId: readRequiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID'),
    workloadIdentityPoolProviderId: readRequiredEnv(
      'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID'
    ),
  };
}

function isIamAuthEnabled(): boolean {
  return getTrimmedEnv('CLOUD_RUN_IAM_AUTH_ENABLED') === 'true';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readResponseToken(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) return undefined;
  const token = value[key];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    TOKEN_EXCHANGE_TIMEOUT_MS
  );

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createProviderAudience(config: CloudRunIamConfig): string {
  return [
    '//iam.googleapis.com/projects',
    config.projectNumber,
    'locations/global/workloadIdentityPools',
    config.workloadIdentityPoolId,
    'providers',
    config.workloadIdentityPoolProviderId,
  ].join('/');
}

async function exchangeVercelTokenForStsToken(
  config: CloudRunIamConfig
): Promise<string> {
  const subjectToken = await getVercelOidcToken({
    expirationBufferMs: TOKEN_EXPIRY_BUFFER_MS,
  });
  const body = new URLSearchParams({
    audience: createProviderAudience(config),
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    scope: CLOUD_PLATFORM_SCOPE,
    subject_token: subjectToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
  });
  const response = await fetchWithTimeout(GOOGLE_STS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `[CloudRunIAM] STS token exchange failed: HTTP ${response.status}.`
    );
  }

  const accessToken = readResponseToken(await response.json(), 'access_token');
  if (!accessToken) {
    throw new Error(
      '[CloudRunIAM] STS response did not include an access token.'
    );
  }
  return accessToken;
}

async function generateGoogleIdToken(
  config: CloudRunIamConfig,
  audience: string
): Promise<string> {
  const accessToken = await exchangeVercelTokenForStsToken(config);
  const serviceAccount = encodeURIComponent(config.serviceAccountEmail);
  const response = await fetchWithTimeout(
    `${GOOGLE_IAM_CREDENTIALS_BASE}/${serviceAccount}:generateIdToken`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audience, includeEmail: true }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `[CloudRunIAM] Google ID token generation failed: HTTP ${response.status}.`
    );
  }

  const token = readResponseToken(await response.json(), 'token');
  if (!token) {
    throw new Error('[CloudRunIAM] IAM response did not include an ID token.');
  }
  return token;
}

function readJwtExpirationMs(token: string): number | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as unknown;
    if (!isRecord(parsed) || typeof parsed.exp !== 'number') return undefined;
    return parsed.exp * 1_000;
  } catch {
    return undefined;
  }
}

function createTokenCacheKey(
  config: CloudRunIamConfig,
  audience: string
): string {
  return [
    config.projectNumber,
    config.workloadIdentityPoolId,
    config.workloadIdentityPoolProviderId,
    config.serviceAccountEmail,
    audience,
  ].join(':');
}

function isCachedTokenUsable(entry: CachedGoogleIdToken, key: string): boolean {
  return (
    entry.key === key && entry.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS > Date.now()
  );
}

async function getGoogleIdToken(
  config: CloudRunIamConfig,
  audience: string
): Promise<string> {
  const key = createTokenCacheKey(config, audience);
  if (cachedGoogleIdToken && isCachedTokenUsable(cachedGoogleIdToken, key)) {
    return cachedGoogleIdToken.token;
  }
  if (inFlightGoogleIdToken?.key === key) {
    return inFlightGoogleIdToken.promise;
  }

  const promise = generateGoogleIdToken(config, audience).then((token) => {
    const expiresAtMs = readJwtExpirationMs(token);
    if (expiresAtMs) {
      cachedGoogleIdToken = { key, token, expiresAtMs };
    }
    return token;
  });
  inFlightGoogleIdToken = { key, promise };

  try {
    return await promise;
  } finally {
    if (inFlightGoogleIdToken?.promise === promise) {
      inFlightGoogleIdToken = undefined;
    }
  }
}

export async function createCloudRunAuthHeaders({
  apiSecret,
  serviceUrl,
}: CreateCloudRunAuthHeadersInput): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-API-Key': apiSecret };
  if (!isIamAuthEnabled()) return headers;

  const audience = new URL(serviceUrl).origin;
  const token = await getGoogleIdToken(readCloudRunIamConfig(), audience);
  headers['X-Serverless-Authorization'] = `Bearer ${token}`;
  return headers;
}

export function resetCloudRunIamTokenCacheForTests(): void {
  cachedGoogleIdToken = undefined;
  inFlightGoogleIdToken = undefined;
}
