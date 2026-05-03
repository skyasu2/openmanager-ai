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
      executionMode: 'single-agent',
      stream: true,
      job: false,
      reasonCodes: ['auto_complexity'],
      traceId: 'trace-stream-1',
      decidedBy: 'cloud-run',
    });
  });

  it('infers M5 executionMode metadata only when the current decision makes it explicit', () => {
    const artifactDecision = buildRouteDecision({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'server-snapshot',
      reasonCodes: ['server_snapshot_implicit_artifact_keyword'],
      decidedBy: 'frontend',
    });
    const multiDecision = buildRouteDecision({
      intent: 'chat',
      executionPath: 'stream',
      mode: 'multi',
      reasonCodes: ['analysis_mode_thinking'],
      decidedBy: 'cloud-run',
    });
    const jobDecision = buildRouteDecision({
      intent: 'job',
      executionPath: 'job',
      reasonCodes: ['job_queue_api'],
      decidedBy: 'bff',
    });

    expect(buildAssistantPlanFromRouteDecision(artifactDecision)).toMatchObject(
      {
        executionMode: 'deterministic',
      }
    );
    expect(buildAssistantPlanFromRouteDecision(multiDecision)).toMatchObject({
      executionMode: 'multi-agent',
    });
    expect(
      buildAssistantPlanFromRouteDecision(jobDecision).executionMode
    ).toBeUndefined();
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

  it('normalizes M5 executionMode, escalation reasons, and public-safe planner shadow metadata', () => {
    const routeDecision = buildRouteDecision({
      intent: 'chat',
      executionPath: 'stream',
      mode: 'single',
      reasonCodes: ['complexity_below_threshold'],
      decidedBy: 'frontend',
    });

    const normalized = normalizeAssistantPlan({
      ...buildAssistantPlanFromRouteDecision(routeDecision),
      executionMode: 'multi-agent',
      escalationReasonCodes: [
        'rca_requested',
        'advisor_requested',
        'owner_internal_debug',
      ],
      plannerShadow: {
        plannerVersion: '2026-05-03-v1',
        candidate: {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'multi-agent',
          reasonCodes: ['rca_requested'],
          escalationReasonCodes: [
            'rca_requested',
            'raw_provider_error_included',
          ],
          decidedBy: 'cloud-run',
        },
        localDecision: {
          executionPath: 'stream',
          mode: 'single',
          reasonCodes: ['complexity_below_threshold'],
          decidedBy: 'frontend',
        },
        drift: {
          matched: false,
          reasonCodes: ['execution_mode_mismatch', 'owner_key_mismatch'],
        },
        latencyMs: 123.4,
        ownerKey: 'owner-secret',
        providerRawError: 'Bearer sk-test-1234567890abcdef',
      },
    });

    expect(normalized).toMatchObject({
      executionMode: 'multi-agent',
      escalationReasonCodes: ['rca_requested', 'advisor_requested'],
      plannerShadow: {
        plannerVersion: '2026-05-03-v1',
        candidate: {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'multi-agent',
          reasonCodes: ['rca_requested'],
          escalationReasonCodes: ['rca_requested'],
          decidedBy: 'cloud-run',
        },
        localDecision: {
          executionPath: 'stream',
          mode: 'single',
          reasonCodes: ['complexity_below_threshold'],
          decidedBy: 'frontend',
        },
        drift: {
          matched: false,
          reasonCodes: ['execution_mode_mismatch'],
        },
        latencyMs: 123,
      },
    });

    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain('owner-secret');
    expect(serialized).not.toContain('sk-test');
    expect(serialized).not.toContain('owner_internal_debug');
    expect(serialized).not.toContain('raw_provider_error_included');
  });
});
