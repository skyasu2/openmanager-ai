import { describe, expect, it, vi } from 'vitest';
import {
  createForcedGuidanceArtifactIntent,
  createForcedGuidanceArtifactQuery,
  submitArtifactGuidanceCta,
} from './chat-artifact-guidance';

describe('chat-artifact-guidance', () => {
  it('maps guidance CTA targets to deterministic artifact requests', () => {
    expect(createForcedGuidanceArtifactQuery('incident-report')).toBe(
      '장애 보고서 작성해줘'
    );
    expect(createForcedGuidanceArtifactIntent('incident-report')).toMatchObject(
      {
        kind: 'incident-report',
        reason: 'incident_report_action_pattern',
      }
    );

    expect(createForcedGuidanceArtifactQuery('monitoring-analysis')).toBe(
      '전체 서버 이상감지 돌려줘'
    );
    expect(
      createForcedGuidanceArtifactIntent('monitoring-analysis')
    ).toMatchObject({
      kind: 'monitoring-analysis',
      reason: 'monitoring_action_pattern',
    });
  });

  it('submits a guidance CTA through an injected artifact generation context', () => {
    const setError = vi.fn();
    const resetRequestState = vi.fn();
    const startArtifactGeneration = vi.fn();

    submitArtifactGuidanceCta({
      target: 'incident-report',
      disableSessionLimit: false,
      sessionLimitReached: false,
      sessionMessageCount: 3,
      hybridIsLoading: false,
      artifactInFlight: false,
      artifactIntentInFlight: false,
      setError,
      resetRequestState,
      startArtifactGeneration,
    });

    expect(setError).toHaveBeenCalledWith(null);
    expect(resetRequestState).toHaveBeenCalledWith('장애 보고서 작성해줘');
    expect(startArtifactGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '장애 보고서 작성해줘',
        artifactIntent: expect.objectContaining({
          kind: 'incident-report',
          reason: 'incident_report_action_pattern',
        }),
      })
    );
  });

  it('blocks guidance CTA submission while chat or artifact work is running', () => {
    const setError = vi.fn();
    const resetRequestState = vi.fn();
    const startArtifactGeneration = vi.fn();

    submitArtifactGuidanceCta({
      target: 'monitoring-analysis',
      disableSessionLimit: false,
      sessionLimitReached: false,
      sessionMessageCount: 3,
      hybridIsLoading: true,
      artifactInFlight: false,
      artifactIntentInFlight: false,
      setError,
      resetRequestState,
      startArtifactGeneration,
    });

    expect(setError).toHaveBeenCalledWith(
      'AI 응답이 진행 중입니다. 완료 후 실행해주세요.'
    );
    expect(resetRequestState).not.toHaveBeenCalled();
    expect(startArtifactGeneration).not.toHaveBeenCalled();
  });
});
