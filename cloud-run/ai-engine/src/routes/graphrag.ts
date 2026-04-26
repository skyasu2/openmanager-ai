import { Hono } from 'hono';
import type { Context } from 'hono';

export const graphragRouter = new Hono();

function graphRuntimeGone(c: Context, replacement = 'searchKnowledgeBase') {
  return c.json(
    {
      error: 'gone',
      message:
        'Legacy graph retrieval runtime was removed. Use Knowledge Retrieval Lite instead.',
      replacement,
      retrievalMode: 'lite',
      deprecated: true,
    },
    410
  );
}

graphragRouter.post('/extract', (c: Context) => {
  return graphRuntimeGone(c);
});

graphragRouter.get('/stats', (c: Context) => {
  return graphRuntimeGone(c, 'Knowledge Retrieval Lite');
});

graphragRouter.get('/related/:nodeId', (c: Context) => {
  return graphRuntimeGone(c);
});
