import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  buildGraphRuntimeGonePayload,
  GRAPH_RUNTIME_GONE_STATUS,
  type GraphRuntimeReplacement,
} from '../lib/legacy-contracts';

export const graphragRouter = new Hono();

function graphRuntimeGone(
  c: Context,
  replacement?: GraphRuntimeReplacement
) {
  return c.json(
    buildGraphRuntimeGonePayload(replacement),
    GRAPH_RUNTIME_GONE_STATUS
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
