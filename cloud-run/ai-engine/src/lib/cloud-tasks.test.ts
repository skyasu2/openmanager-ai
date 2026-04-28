import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./logger', () => ({
  logger: mockLogger,
}));

import {
  buildCreateTaskRequest,
  CLOUD_TASKS_MAX_PAYLOAD_BYTES,
  CloudTasksPayloadTooLargeError,
  enqueueCloudTask,
  getCloudTasksConfig,
} from './cloud-tasks';

describe('cloud tasks config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('requires explicit Cloud Tasks enablement', () => {
    process.env.CLOUD_TASKS_ENABLED = 'false';

    expect(getCloudTasksConfig()).toMatchObject({
      ok: false,
      code: 'disabled',
    });
  });

  it('resolves project from GOOGLE_CLOUD_PROJECT when explicit project is absent', () => {
    process.env.CLOUD_TASKS_ENABLED = 'true';
    delete process.env.CLOUD_TASKS_PROJECT_ID;
    process.env.GOOGLE_CLOUD_PROJECT = 'runtime-project';
    process.env.CLOUD_TASKS_LOCATION = 'asia-northeast1';
    process.env.CLOUD_TASKS_QUEUE_ID = 'ai-jobs';
    process.env.CLOUD_RUN_API_SECRET = 'secret';

    expect(getCloudTasksConfig()).toMatchObject({
      ok: true,
      projectId: 'runtime-project',
      location: 'asia-northeast1',
      queueId: 'ai-jobs',
    });
  });
});

describe('buildCreateTaskRequest', () => {
  it('builds a Cloud Tasks HTTP request with API key and encoded JSON body', () => {
    const payload = {
      jobId: 'job-123',
      messages: [{ role: 'user', content: 'server health' }],
      analysisMode: 'thinking',
    };

    const request = buildCreateTaskRequest({
      config: {
        ok: true,
        projectId: 'test-project',
        location: 'asia-northeast1',
        queueId: 'ai-jobs',
        apiSecret: 'secret',
        serviceAccountEmail: 'tasks@test-project.iam.gserviceaccount.com',
        dispatchDeadlineSeconds: 600,
      },
      targetUrl: 'https://ai.example.run.app/api/jobs/process',
      payload,
      headers: { 'X-Rate-Limit-Identity': 'guest:abc123' },
    });

    expect(request.parent).toBe(
      'projects/test-project/locations/asia-northeast1/queues/ai-jobs'
    );
    expect(request.body).toMatchObject({
      task: {
        dispatchDeadline: '600s',
        httpRequest: {
          httpMethod: 'POST',
          url: 'https://ai.example.run.app/api/jobs/process',
          headers: {
            'Content-Type': 'application/json',
            'X-Rate-Limit-Identity': 'guest:abc123',
            'X-API-Key': 'secret',
          },
          oidcToken: {
            serviceAccountEmail: 'tasks@test-project.iam.gserviceaccount.com',
            audience: 'https://ai.example.run.app',
          },
        },
      },
    });

    const task = request.body.task as {
      httpRequest: { body: string };
    };
    expect(
      JSON.parse(Buffer.from(task.httpRequest.body, 'base64').toString('utf8'))
    ).toEqual(payload);
  });

  it('only forwards explicitly allowed task headers', () => {
    const request = buildCreateTaskRequest({
      config: {
        ok: true,
        projectId: 'test-project',
        location: 'asia-northeast1',
        queueId: 'ai-jobs',
        apiSecret: 'secret',
        dispatchDeadlineSeconds: 600,
      },
      targetUrl: 'https://ai.example.run.app/api/jobs/process',
      payload: { jobId: 'job-123' },
      headers: {
        Authorization: 'Bearer user-token',
        Cookie: 'session=abc',
        'Content-Type': 'text/plain',
        'X-API-Key': 'client-secret',
        'X-Forwarded-For': '203.0.113.1',
        'X-Rate-Limit-Identity': ' guest:abc123 ',
      },
    });

    const task = request.body.task as {
      httpRequest: { headers: Record<string, string> };
    };

    expect(task.httpRequest.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Rate-Limit-Identity': 'guest:abc123',
      'X-API-Key': 'secret',
    });
  });

  it('rejects payloads that exceed the Cloud Tasks enqueue budget', () => {
    const oversizedPayload = {
      jobId: 'job-oversized',
      messages: [
        {
          role: 'user',
          content: 'x'.repeat(CLOUD_TASKS_MAX_PAYLOAD_BYTES),
        },
      ],
    };

    expect(() =>
      buildCreateTaskRequest({
        config: {
          ok: true,
          projectId: 'test-project',
          location: 'asia-northeast1',
          queueId: 'ai-jobs',
          apiSecret: 'secret',
          dispatchDeadlineSeconds: 600,
        },
        targetUrl: 'https://ai.example.run.app/api/jobs/process',
        payload: oversizedPayload,
      })
    ).toThrow(CloudTasksPayloadTooLargeError);
  });
});

describe('enqueueCloudTask', () => {
  const config = {
    ok: true as const,
    projectId: 'test-project',
    location: 'asia-northeast1',
    queueId: 'ai-jobs',
    apiSecret: 'secret',
    dispatchDeadlineSeconds: 600,
  };

  const input = {
    config,
    targetUrl: 'https://ai.example.run.app/api/jobs/process',
    payload: { jobId: 'job-123' },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('retries one transient Cloud Tasks create failure', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'metadata-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response('backend unavailable', { status: 503 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'tasks/task-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(enqueueCloudTask(input)).resolves.toEqual({
      name: 'tasks/task-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://cloudtasks.googleapis.com/v2/projects/test-project/locations/asia-northeast1/queues/ai-jobs/tasks'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      'https://cloudtasks.googleapis.com/v2/projects/test-project/locations/asia-northeast1/queues/ai-jobs/tasks'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 503')
    );
  });

  it('does not retry non-transient Cloud Tasks create failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'metadata-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(enqueueCloudTask(input)).rejects.toThrow(
      'Cloud Tasks createTask failed: bad request'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[CloudTasks] createTask failed: HTTP 400'
    );
  });
});
