import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_INTENT_RULE_VERSION,
  classifyChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { artifactIntentCorpus } from '../fixtures/chat-artifact-intent/intent-corpus';
import {
  ARTIFACT_INTENT_EVALUATION_KINDS,
  evaluateArtifactIntentClassifier,
  formatRatio,
} from './intent-classifier-metrics';

const LOCAL_CLASSIFIER_PRECISION_THRESHOLD = 0.94;

const evaluation = evaluateArtifactIntentClassifier(
  artifactIntentCorpus.cases,
  classifyChatArtifactIntent
);

function printEvaluationSummary(): void {
  console.table(
    ARTIFACT_INTENT_EVALUATION_KINDS.map((kind) => {
      const metrics = evaluation.metrics[kind];

      return {
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
  console.table(evaluation.confusion);
}

describe('Artifact Intent Local Classifier Evaluation', () => {
  it('keeps the deterministic corpus aligned with the active rule version', () => {
    expect(artifactIntentCorpus.version).toBe(ARTIFACT_INTENT_RULE_VERSION);
    expect(evaluation.predictions).toHaveLength(
      artifactIntentCorpus.cases.length
    );
    expect(
      evaluation.predictions.every(
        (prediction) => prediction.ruleVersion === ARTIFACT_INTENT_RULE_VERSION
      )
    ).toBe(true);
  });

  it(`keeps local artifact precision >= ${LOCAL_CLASSIFIER_PRECISION_THRESHOLD}`, () => {
    printEvaluationSummary();

    expect(
      evaluation.metrics['incident-report'].precision
    ).toBeGreaterThanOrEqual(LOCAL_CLASSIFIER_PRECISION_THRESHOLD);
    expect(
      evaluation.metrics['monitoring-analysis'].precision
    ).toBeGreaterThanOrEqual(LOCAL_CLASSIFIER_PRECISION_THRESHOLD);
  });
});
