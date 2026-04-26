import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import { graphragRouter } from './graphrag';

const app = new Hono();
app.route('/graphrag', graphragRouter);

describe('deprecated GraphRAG routes', () => {
  it('returns 410 for extraction requests', async () => {
    const res = await app.request('/graphrag/extract', {
      method: 'POST',
      body: JSON.stringify({ batchSize: 25 }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      error: 'gone',
      replacement: 'searchKnowledgeBase',
    });
  });

  it('returns 410 for stats requests instead of calling graph services', async () => {
    const res = await app.request('/graphrag/stats');

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      error: 'gone',
      replacement: 'Knowledge Retrieval Lite',
    });
  });

  it('returns 410 for related-node requests instead of graph traversal', async () => {
    const res = await app.request('/graphrag/related/node-abc?maxHops=3');

    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toMatchObject({
      error: 'gone',
      replacement: 'searchKnowledgeBase',
    });
  });
});
