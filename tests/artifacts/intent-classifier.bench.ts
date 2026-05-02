import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_INTENT_RULE_VERSION,
  classifyChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { artifactIntentCorpus } from '../fixtures/artifacts/intent-corpus';
import {
  ARTIFACT_INTENT_EVALUATION_KINDS,
  evaluateArtifactIntentClassifier,
  formatRatio,
} from '../intent-classifier/intent-classifier-metrics';

const EXECUTION_PRECISION_THRESHOLD = 0.94;

const evaluation = evaluateArtifactIntentClassifier(
  artifactIntentCorpus.cases,
  classifyChatArtifactIntent
);

describe('Artifact Intent Classifier Benchmark', () => {
  it('reports deterministic local classifier precision and confusion matrix', () => {
    console.table(
      ARTIFACT_INTENT_EVALUATION_KINDS.map((kind) => {
        const metrics = evaluation.metrics[kind];

        return {
          ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
          kind,
          support: metrics.support,
          predicted: metrics.predicted,
          precision: formatRatio(metrics.precision),
          recall: formatRatio(metrics.recall),
        };
      })
    );
    console.table(evaluation.confusion);

    expect(artifactIntentCorpus.version).toBe(ARTIFACT_INTENT_RULE_VERSION);
    expect(
      evaluation.metrics['incident-report'].precision
    ).toBeGreaterThanOrEqual(EXECUTION_PRECISION_THRESHOLD);
    expect(
      evaluation.metrics['monitoring-analysis'].precision
    ).toBeGreaterThanOrEqual(EXECUTION_PRECISION_THRESHOLD);
    expect(
      evaluation.metrics['server-snapshot'].precision ?? 0
    ).toBeGreaterThanOrEqual(EXECUTION_PRECISION_THRESHOLD);
  });
});
