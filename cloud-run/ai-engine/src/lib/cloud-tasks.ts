import { logger } from './logger';

export type CloudTasksConfigFailureCode =
  | 'disabled'
  | 'missing_project_id'
  | 'missing_location'
  | 'missing_queue'
  | 'missing_api_secret';

export type CloudTasksConfigResult =
  | {
      ok: true;
      projectId: string;
      location: string;
      queueId: string;
      apiSecret: string;
      serviceAccountEmail?: string;
      oidcAudience?: string;
      dispatchDeadlineSeconds: number;
    }
  | {
      ok: false;
      code: CloudTasksConfigFailureCode;
      message: string;
    };

export interface EnqueueCloudTaskInput {
  config: Extract<CloudTasksConfigResult, { ok: true }>;
  targetUrl: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string | undefined>;
}

export interface EnqueueCloudTaskResult {
  name: string | null;
}

interface MetadataTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const CLOUD_TASKS_API_BASE = 'https://cloudtasks.googleapis.com/v2';
const DEFAULT_DISPATCH_DEADLINE_SECONDS = 600;
const MAX_DISPATCH_DEADLINE_SECONDS = 1800;
const METADATA_TOKEN_TIMEOUT_MS = 3000;
const CREATE_TASK_TIMEOUT_MS = 5000;

function getTrimmedEnv(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function parseDispatchDeadlineSeconds(): number {
  const raw = Number.parseInt(
    getTrimmedEnv('CLOUD_TASKS_DISPATCH_DEADLINE_SECONDS'),
    10
  );

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_DISPATCH_DEADLINE_SECONDS;
  }

  return Math.min(raw, MAX_DISPATCH_DEADLINE_SECONDS);
}

export function getCloudTasksConfig(): CloudTasksConfigResult {
  if (getTrimmedEnv('CLOUD_TASKS_ENABLED') !== 'true') {
    return {
      ok: false,
      code: 'disabled',
      message: 'CLOUD_TASKS_ENABLED is not true',
    };
  }

  const projectId =
    getTrimmedEnv('CLOUD_TASKS_PROJECT_ID') ||
    getTrimmedEnv('GOOGLE_CLOUD_PROJECT') ||
    getTrimmedEnv('GCP_PROJECT_ID');
  const location = getTrimmedEnv('CLOUD_TASKS_LOCATION');
  const queueId = getTrimmedEnv('CLOUD_TASKS_QUEUE_ID');
  const apiSecret = getTrimmedEnv('CLOUD_RUN_API_SECRET');

  if (!projectId) {
    return {
      ok: false,
      code: 'missing_project_id',
      message: 'CLOUD_TASKS_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required',
    };
  }

  if (!location) {
    return {
      ok: false,
      code: 'missing_location',
      message: 'CLOUD_TASKS_LOCATION is required',
    };
  }

  if (!queueId) {
    return {
      ok: false,
      code: 'missing_queue',
      message: 'CLOUD_TASKS_QUEUE_ID is required',
    };
  }

  if (!apiSecret) {
    return {
      ok: false,
      code: 'missing_api_secret',
      message: 'CLOUD_RUN_API_SECRET is required',
    };
  }

  const serviceAccountEmail = getTrimmedEnv(
    'CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL'
  );
  const oidcAudience = getTrimmedEnv('CLOUD_TASKS_OIDC_AUDIENCE');

  return {
    ok: true,
    projectId,
    location,
    queueId,
    apiSecret,
    ...(serviceAccountEmail && { serviceAccountEmail }),
    ...(oidcAudience && { oidcAudience }),
    dispatchDeadlineSeconds: parseDispatchDeadlineSeconds(),
  };
}

export function getCloudTasksParent(
  config: Extract<CloudTasksConfigResult, { ok: true }>
): string {
  return `projects/${config.projectId}/locations/${config.location}/queues/${config.queueId}`;
}

export function buildCreateTaskRequest(input: EnqueueCloudTaskInput): {
  parent: string;
  body: Record<string, unknown>;
} {
  const parent = getCloudTasksParent(input.config);
  const forwardedHeaders = Object.fromEntries(
    Object.entries(input.headers ?? {}).flatMap(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === 'content-type' || normalizedKey === 'x-api-key') {
        return [];
      }

      const trimmedValue = value?.trim();
      return trimmedValue ? [[key, trimmedValue]] : [];
    })
  );
  const httpRequest: Record<string, unknown> = {
    httpMethod: 'POST',
    url: input.targetUrl,
    headers: {
      'Content-Type': 'application/json',
      ...forwardedHeaders,
      'X-API-Key': input.config.apiSecret,
    },
    body: Buffer.from(JSON.stringify(input.payload), 'utf8').toString('base64'),
  };

  if (input.config.serviceAccountEmail) {
    httpRequest.oidcToken = {
      serviceAccountEmail: input.config.serviceAccountEmail,
      audience:
        input.config.oidcAudience ?? new URL(input.targetUrl).origin,
    };
  }

  return {
    parent,
    body: {
      task: {
        httpRequest,
        dispatchDeadline: `${input.config.dispatchDeadlineSeconds}s`,
      },
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getMetadataAccessToken(): Promise<string> {
  const response = await fetchWithTimeout(
    METADATA_TOKEN_URL,
    {
      method: 'GET',
      headers: {
        'Metadata-Flavor': 'Google',
      },
    },
    METADATA_TOKEN_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`metadata token request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as MetadataTokenResponse;
  if (!payload.access_token) {
    throw new Error('metadata token response did not include access_token');
  }

  return payload.access_token;
}

export async function enqueueCloudTask(
  input: EnqueueCloudTaskInput
): Promise<EnqueueCloudTaskResult> {
  const { parent, body } = buildCreateTaskRequest(input);
  const accessToken = await getMetadataAccessToken();

  const response = await fetchWithTimeout(
    `${CLOUD_TASKS_API_BASE}/${parent}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    CREATE_TASK_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    logger.error(`[CloudTasks] createTask failed: HTTP ${response.status}`);
    throw new Error(`Cloud Tasks createTask failed: ${errorText}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { name?: string }
    | null;

  return {
    name: payload?.name ?? null,
  };
}
