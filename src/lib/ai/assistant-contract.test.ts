import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CONTRACT_VERSION,
  buildAssistantPlanFromRouteDecision,
  buildAssistantResultFromRouteDecision,
  normalizeAssistantPlan,
  normalizeAssistantResult,
} from './assistant-contract';
import { buildRouteDecision } from './route-decision';

describe('assistant plan/result facade contract', () => {
  it('builds a stream chat plan from routeDecision without changing routing authority', () => {
    const routeDecision = buildRouteDecision({
      intent: 'chat',
      executionPath: 'stream',
      mode: 'single',
      reasonCodes: ['auto_complexity'],
      decidedBy: 'cloud-run',
      traceId: 'trace-stream-1',
    });

    expect(buildAssistantPlanFromRouteDecision(routeDecision)).toEqual({
      kind: 'chat',
      planVersion: ASSISTANT_CONTRACT_VERSION,
      routeDecision,
      executionPath: 'stream',
      stream: true,
      job: false,
      reasonCodes: ['auto_complexity'],
      traceId: 'trace-stream-1',
      decidedBy: 'cloud-run',
    });
  });

  it('builds an artifact result facade from artifact routeDecision', () => {
    const routeDecision = buildRouteDecision({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'server-snapshot',
      reasonCodes: ['server_snapshot_implicit_artifact_keyword'],
      dataSlot: '07:00 KST',
      decidedBy: 'frontend',
    });

    expect(buildAssistantResultFromRouteDecision(routeDecision)).toEqual({
      kind: 'artifact',
      resultVersion: ASSISTANT_CONTRACT_VERSION,
      routeDecision,
      status: 'completed',
      artifactKind: 'server-snapshot',
    });
  });

  it('normalizes valid metadata and rejects invalid enum drift', () => {
    const routeDecision = buildRouteDecision({
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['job_queue_api'],
      decidedBy: 'bff',
    });
    const plan = buildAssistantPlanFromRouteDecision(routeDecision);
    const result = buildAssistantResultFromRouteDecision(routeDecision);

    expect(normalizeAssistantPlan(plan)).toEqual(plan);
    expect(normalizeAssistantResult(result)).toEqual(result);
    expect(
      normalizeAssistantPlan({
        ...plan,
        kind: 'workflow',
      })
    ).toBeUndefined();
    expect(
      normalizeAssistantResult({
        ...result,
        status: 'unknown',
      })
    ).toBeUndefined();
  });
});
