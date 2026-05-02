import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_INTENT_RULE_VERSION,
  classifyChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import {
  type ArtifactIntentCorpusCategory,
  artifactIntentCorpus,
  artifactIntentCorpusCategories,
} from '../fixtures/artifacts/intent-corpus';
import {
  ARTIFACT_INTENT_EVALUATION_KINDS,
  type ArtifactIntentEvaluationKind,
  evaluateArtifactIntentClassifier,
  formatRatio,
} from './intent-classifier-metrics';

const LOCAL_CLASSIFIER_PRECISION_THRESHOLD = 0.94;
const LOCAL_CLASSIFIER_CLASS_HEALTH_THRESHOLD = 0.9;
const LOCAL_CLASSIFIER_MIN_KIND_SUPPORT = {
  'incident-report': 18,
  'monitoring-analysis': 18,
  'server-snapshot': 8,
  guidance: 30,
  none: 38,
} satisfies Record<ArtifactIntentEvaluationKind, number>;
const LOCAL_CLASSIFIER_MIN_CATEGORY_SUPPORT = {
  'explicit-action': 16,
  'implicit-artifact': 4,
  'guidance-question': 19,
  negation: 16,
  'operational-chat': 17,
  'ambiguous-chat': 3,
  navigation: 6,
  'mixed-language': 22,
  'snapshot-artifact': 8,
} satisfies Record<ArtifactIntentCorpusCategory, number>;

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
  console.table(
    artifactIntentCorpusCategories.map((category) => {
      const metrics = evaluation.categoryMetrics[category];

      return {
        category,
        support: metrics.support,
        correct: metrics.correct,
        mismatches: metrics.mismatches,
        accuracy: formatRatio(metrics.accuracy),
      };
    })
  );
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
    expect(
      evaluation.metrics['server-snapshot'].precision ?? 0
    ).toBeGreaterThanOrEqual(LOCAL_CLASSIFIER_PRECISION_THRESHOLD);
  });

  it('keeps all local classifier classes represented and healthy', () => {
    for (const kind of ARTIFACT_INTENT_EVALUATION_KINDS) {
      const metrics = evaluation.metrics[kind];

      expect(metrics.support).toBeGreaterThanOrEqual(
        LOCAL_CLASSIFIER_MIN_KIND_SUPPORT[kind]
      );
      expect(metrics.predicted).toBeGreaterThan(0);
      expect(metrics.precision).not.toBeNull();
      expect(metrics.recall).not.toBeNull();
      expect(metrics.precision ?? 0).toBeGreaterThanOrEqual(
        LOCAL_CLASSIFIER_CLASS_HEALTH_THRESHOLD
      );
      expect(metrics.recall ?? 0).toBeGreaterThanOrEqual(
        LOCAL_CLASSIFIER_CLASS_HEALTH_THRESHOLD
      );
    }
  });

  it('keeps all corpus categories represented and healthy', () => {
    for (const category of artifactIntentCorpusCategories) {
      const metrics = evaluation.categoryMetrics[category];

      expect(metrics.support).toBeGreaterThanOrEqual(
        LOCAL_CLASSIFIER_MIN_CATEGORY_SUPPORT[category]
      );
      expect(metrics.accuracy).not.toBeNull();
      expect(metrics.accuracy ?? 0).toBeGreaterThanOrEqual(
        LOCAL_CLASSIFIER_CLASS_HEALTH_THRESHOLD
      );
    }
  });
});
