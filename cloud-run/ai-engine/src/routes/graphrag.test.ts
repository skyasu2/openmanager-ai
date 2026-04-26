import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import { graphragRouter } from './graphrag';

const app = new Hono();
app.route('/graphrag', graphragRouter);

describe('deprecated GraphRAG routes', () => {
  it.each([
    {
      name: 'extraction requests',
      path: '/graphrag/extract',
      method: 'POST',
      body: { batchSize: 25 },
      replacement: 'searchKnowledgeBase',
    },
    {
      name: 'stats requests',
      path: '/graphrag/stats',
      method: 'GET',
      replacement: 'Knowledge Retrieval Lite',
    },
    {
      name: 'related-node requests',
      path: '/graphrag/related/node-abc?maxHops=3',
      method: 'GET',
      replacement: 'searchKnowledgeBase',
    },
  ] as const)('returns 410 for $name', async ({ body, method, path, replacement }) => {
    const res = await app.request(path, {
      method,
      ...(body
        ? {
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
          }
        : {}),
    });

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      error: 'gone',
      message: expect.stringContaining('Knowledge Retrieval Lite'),
      replacement,
      retrievalMode: 'lite',
      deprecated: true,
    });
  });
});
