import { describe, expect, it } from 'vitest';
import { classifyChatArtifactIntent } from '@/app/api/ai/artifact-intent/deterministic';
import { ARTIFACT_INTENT_RULE_VERSION } from '@/lib/ai/chat-artifacts/artifact-intent-contract';
import { artifactIntentProductionSampleCorpus } from '../fixtures/artifacts/intent-production-sample-corpus';
import {
  ARTIFACT_INTENT_EVALUATION_KINDS,
  evaluateArtifactIntentClassifier,
  formatRatio,
} from './intent-classifier-metrics';

const PRODUCTION_REPLAY_MIN_CASES = 18;
const PRODUCTION_REPLAY_MIN_ACCURACY = 1;
const PRODUCTION_REPLAY_MIN_PRECISION = 0.95;
const PRODUCTION_REPLAY_MIN_RECALL = 0.95;

const evaluation = evaluateArtifactIntentClassifier(
  artifactIntentProductionSampleCorpus.cases,
  classifyChatArtifactIntent
);

function printProductionReplaySummary(): void {
  console.table(
    ARTIFACT_INTENT_EVALUATION_KINDS.map((kind) => {
      const metrics = evaluation.metrics[kind];

      return {
        sourceVersion: artifactIntentProductionSampleCorpus.sourceVersion,
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
        kind,
        support: metrics.support,
        predicted: metrics.predicted,
        truePositive: metrics.truePositive,
        falsePositive: metrics.falsePositive,
        falseNegative: metrics.falseNegative,
        precision: formatRatio(metrics.precision),
        recall: formatRatio(metrics.recall),
      };
    })
  );
}

describe('Artifact Intent Production Sample Replay', () => {
  it('keeps the replay fixture aligned with the active classifier rule version', () => {
    expect(artifactIntentProductionSampleCorpus.sourceVersion).toBe(
      '2026-05-05-v1'
    );
    expect(artifactIntentProductionSampleCorpus.classifierRuleVersion).toBe(
      ARTIFACT_INTENT_RULE_VERSION
    );
    expect(
      artifactIntentProductionSampleCorpus.cases.length
    ).toBeGreaterThanOrEqual(PRODUCTION_REPLAY_MIN_CASES);
  });

  it('keeps QA-derived and anonymized production-style samples free of intent drift', () => {
    printProductionReplaySummary();

    expect(evaluation.accuracy).toBeGreaterThanOrEqual(
      PRODUCTION_REPLAY_MIN_ACCURACY
    );
    expect(evaluation.mismatches).toEqual([]);
  });

  it('keeps artifact execution precision and recall above the replay threshold', () => {
    for (const kind of ARTIFACT_INTENT_EVALUATION_KINDS) {
      const metrics = evaluation.metrics[kind];

      if (metrics.support === 0 && metrics.predicted === 0) continue;

      expect(metrics.precision ?? 0).toBeGreaterThanOrEqual(
        PRODUCTION_REPLAY_MIN_PRECISION
      );
      expect(metrics.recall ?? 0).toBeGreaterThanOrEqual(
        PRODUCTION_REPLAY_MIN_RECALL
      );
    }
  });
});
