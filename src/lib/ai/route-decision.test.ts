import { describe, expect, it } from 'vitest';
import {
  buildRouteDecision,
  normalizeRouteDecision,
  ROUTE_DECISION_RULE_VERSION,
} from './route-decision';

describe('routeDecision contract', () => {
  it('builds a stable read-only route decision envelope', () => {
    expect(
      buildRouteDecision({
        intent: 'job',
        executionPath: 'job',
        complexity: 'complex',
        reasonCodes: ['complexity_threshold_exceeded'],
        decidedBy: 'frontend',
        dataSlot: '21:50 KST',
      })
    ).toEqual({
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['complexity_threshold_exceeded'],
      ruleVersion: ROUTE_DECISION_RULE_VERSION,
      decidedBy: 'frontend',
      dataSlot: '21:50 KST',
    });
  });

  it('normalizes valid metadata and rejects invalid enum drift', () => {
    expect(
      normalizeRouteDecision({
        intent: 'artifact',
        executionPath: 'client-artifact',
        artifactKind: 'server-snapshot',
        reasonCodes: ['server_snapshot_implicit_artifact_keyword'],
        ruleVersion: ROUTE_DECISION_RULE_VERSION,
        decidedBy: 'frontend',
      })
    ).toMatchObject({
      intent: 'artifact',
      executionPath: 'client-artifact',
      artifactKind: 'server-snapshot',
    });

    expect(
      normalizeRouteDecision({
        intent: 'magic',
        executionPath: 'job',
        reasonCodes: [],
        ruleVersion: ROUTE_DECISION_RULE_VERSION,
        decidedBy: 'frontend',
      })
    ).toBeUndefined();
  });
});
