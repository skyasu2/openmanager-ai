import { afterEach, describe, expect, it } from 'vitest';

import { buildCreateTaskRequest, getCloudTasksConfig } from './cloud-tasks';

describe('cloud tasks config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
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
});
