import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEnqueueCloudTask,
  mockGetCloudTasksConfig,
  mockIsJobNotifierAvailable,
  mockUpdateJobProgress,
} = vi.hoisted(() => ({
  mockEnqueueCloudTask: vi.fn(),
  mockGetCloudTasksConfig: vi.fn(),
  mockIsJobNotifierAvailable: vi.fn(),
  mockUpdateJobProgress: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/model-config', () => ({
  validateAPIKeys: vi.fn(() => ({ all: true })),
  logAPIKeyStatus: vi.fn(),
}));

vi.mock('../lib/job-notifier', () => ({
  markJobProcessing: vi.fn(async () => true),
  storeJobResult: vi.fn(async () => true),
  storeJobError: vi.fn(async () => true),
  getJobResult: vi.fn(async () => null),
  updateJobProgress: mockUpdateJobProgress,
  isJobNotifierAvailable: mockIsJobNotifierAvailable,
  getJobProgress: vi.fn(async () => null),
}));

vi.mock('../lib/cloud-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/cloud-tasks')>();
  return {
    ...actual,
    enqueueCloudTask: mockEnqueueCloudTask,
    getCloudTasksConfig: mockGetCloudTasksConfig,
  };
});

vi.mock('../services/ai-sdk', () => ({
  executeSupervisorStream: vi.fn(async function* () {}),
  logProviderStatus: vi.fn(),
}));

import { jobsRouter } from './jobs';
import { CloudTasksPayloadTooLargeError } from '../lib/cloud-tasks';

const app = new Hono();
app.route('/jobs', jobsRouter);

describe('POST /jobs/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsJobNotifierAvailable.mockReturnValue(true);
    mockUpdateJobProgress.mockResolvedValue(true);
    mockGetCloudTasksConfig.mockReturnValue({
      ok: true,
      projectId: 'test-project',
      location: 'asia-northeast1',
      queueId: 'ai-jobs',
      apiSecret: 'test-secret',
      dispatchDeadlineSeconds: 600,
    });
    mockEnqueueCloudTask.mockResolvedValue({
      name: 'projects/test-project/locations/asia-northeast1/queues/ai-jobs/tasks/task-1',
    });
  });

  it('enqueues a Cloud Tasks HTTP task and preserves job payload options', async () => {
    const payload = {
      jobId: 'job-123',
      messages: [{ role: 'user', content: 'server health' }],
      sessionId: 'session-1',
      type: 'analysis',
      enableRAG: true,
      enableWebSearch: true,
    };

    const res = await app.request('/jobs/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rate-Limit-Identity': 'guest:abc123',
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      jobId: 'job-123',
      status: 'queued',
      dispatchMode: 'cloud-tasks',
      taskName:
        'projects/test-project/locations/asia-northeast1/queues/ai-jobs/tasks/task-1',
    });
    expect(mockEnqueueCloudTask).toHaveBeenCalledWith({
      config: expect.objectContaining({
        projectId: 'test-project',
        queueId: 'ai-jobs',
      }),
      targetUrl: 'http://localhost/api/jobs/process',
      payload,
      headers: { 'X-Rate-Limit-Identity': 'guest:abc123' },
    });
    expect(mockUpdateJobProgress).toHaveBeenCalledWith(
      'job-123',
      'queued',
      10,
      'Cloud Tasks 작업 등록 완료'
    );
  });

  it('forces HTTPS for proxied Cloud Run task targets to avoid redirecting POST to GET', async () => {
    const payload = {
      jobId: 'job-cloud-run-url',
      messages: [{ role: 'user', content: 'server health' }],
    };

    const res = await app.request(
      'http://ai-engine-jdhrhws7ia-an.a.run.app/jobs/dispatch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    expect(res.status).toBe(202);
    expect(mockEnqueueCloudTask).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'https://ai-engine-jdhrhws7ia-an.a.run.app/api/jobs/process',
      })
    );
  });

  it('honors X-Forwarded-Proto when building the Cloud Tasks process target', async () => {
    const payload = {
      jobId: 'job-forwarded-proto',
      messages: [{ role: 'user', content: 'server health' }],
    };

    const res = await app.request('http://internal.example.com/jobs/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(202);
    expect(mockEnqueueCloudTask).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'https://internal.example.com/api/jobs/process',
      })
    );
  });

  it('does not let forwarded proto downgrade a non-local task target to HTTP', async () => {
    const payload = {
      jobId: 'job-forwarded-http',
      messages: [{ role: 'user', content: 'server health' }],
    };

    const res = await app.request(
      'http://ai-engine-jdhrhws7ia-an.a.run.app/jobs/dispatch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-Proto': 'http',
        },
        body: JSON.stringify(payload),
      }
    );

    expect(res.status).toBe(202);
    expect(mockEnqueueCloudTask).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: 'https://ai-engine-jdhrhws7ia-an.a.run.app/api/jobs/process',
      })
    );
  });

  it('returns 413 when the Cloud Tasks payload is too large to enqueue', async () => {
    mockEnqueueCloudTask.mockRejectedValue(
      new CloudTasksPayloadTooLargeError({
        payloadBytes: 70000,
        maxBytes: 65536,
      })
    );

    const res = await app.request('/jobs/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'job-oversized',
        messages: [{ role: 'user', content: 'server health' }],
      }),
    });

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      details: {
        payloadBytes: 70000,
        maxBytes: 65536,
      },
    });
  });

  it('returns 503 when Cloud Tasks is not configured', async () => {
    mockGetCloudTasksConfig.mockReturnValue({
      ok: false,
      code: 'disabled',
      message: 'CLOUD_TASKS_ENABLED is not true',
    });

    const res = await app.request('/jobs/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'job-123',
        messages: [{ role: 'user', content: 'server health' }],
      }),
    });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      code: 'disabled',
    });
    expect(mockEnqueueCloudTask).not.toHaveBeenCalled();
  });
});
