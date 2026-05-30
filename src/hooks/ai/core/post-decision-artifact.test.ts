import { describe, expect, it } from 'vitest';
import type { RouteDecisionArtifactKind } from '@/lib/ai/route-decision';
import type { AsyncQueryResult } from '../useAsyncAIQuery';
import { resolvePostDecisionArtifactIntent } from './post-decision-artifact';

function clientArtifactRoute(artifactKind: RouteDecisionArtifactKind) {
  return {
    intent: 'artifact' as const,
    executionPath: 'client-artifact' as const,
    artifactKind,
    reasonCodes: ['artifact_shadow_candidate'],
    ruleVersion: '2026-05-03-v1',
    decidedBy: 'cloud-run' as const,
  };
}

describe('resolvePostDecisionArtifactIntent', () => {
  it('converts assistantPlan routeDecision artifactKind to a chat artifact intent', () => {
    const routeDecision = clientArtifactRoute('server-snapshot');
    const result: AsyncQueryResult = {
      success: true,
      response: '서버 상태 스냅샷을 준비합니다.',
      assistantPlan: {
        kind: 'chat',
        planVersion: '2026-05-03-v1',
        routeDecision,
        executionPath: 'client-artifact',
        stream: false,
        job: false,
        artifactKind: 'server-snapshot',
        reasonCodes: ['artifact_shadow_candidate'],
        decidedBy: 'cloud-run',
      },
    };

    expect(
      resolvePostDecisionArtifactIntent({
        result,
        query: '현재 상태를 보기 좋게 정리해줘',
      })
    ).toMatchObject({
      kind: 'server-snapshot',
      reason: 'llm_artifact_classification',
    });
  });

  it('enriches server-monitoring-analysis intent with the server id parsed from the query', () => {
    const result: AsyncQueryResult = {
      success: true,
      routeDecision: clientArtifactRoute('server-monitoring-analysis'),
    };

    expect(
      resolvePostDecisionArtifactIntent({
        result,
        query: 'api-was-dc1-01 이상감지 분석해줘',
      })
    ).toMatchObject({
      kind: 'server-monitoring-analysis',
      serverId: 'api-was-dc1-01',
      reason: 'server_monitoring_action_pattern',
    });
  });

  it('ignores job-path metadata even when an artifactKind is present', () => {
    const result: AsyncQueryResult = {
      success: true,
      routeDecision: {
        intent: 'job',
        executionPath: 'job',
        artifactKind: 'server-snapshot',
        reasonCodes: ['job_queue_api'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'cloud-run',
      },
    };

    expect(
      resolvePostDecisionArtifactIntent({
        result,
        query: '서버 상태를 확인해줘',
      })
    ).toBeNull();
  });
});
