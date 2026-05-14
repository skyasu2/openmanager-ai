import type { ChatArtifactIntent } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import type {
  ArtifactIntentCorpusCase,
  ArtifactIntentCorpusCategory,
  ArtifactIntentExpectedKind,
} from '../fixtures/artifacts/intent-corpus';
import { artifactIntentCorpusCategories } from '../fixtures/artifacts/intent-corpus';

export const ARTIFACT_INTENT_EVALUATION_KINDS = [
  'incident-report',
  'monitoring-analysis',
  'server-monitoring-analysis',
  'server-snapshot',
  'guidance',
  'none',
] as const satisfies readonly ArtifactIntentExpectedKind[];

export type ArtifactIntentEvaluationKind =
  (typeof ARTIFACT_INTENT_EVALUATION_KINDS)[number];

export type ArtifactIntentConfusionMatrix = Record<
  ArtifactIntentEvaluationKind,
  Record<ArtifactIntentEvaluationKind, number>
>;

export interface ArtifactIntentPrediction {
  id: string;
  query: string;
  category: ArtifactIntentCorpusCategory;
  note: string;
  expected: ArtifactIntentEvaluationKind;
  predicted: ArtifactIntentEvaluationKind;
  ruleVersion: string;
}

export interface ArtifactIntentKindMetrics {
  kind: ArtifactIntentEvaluationKind;
  support: number;
  predicted: number;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number | null;
  recall: number | null;
}

export interface ArtifactIntentCategoryMetrics {
  category: ArtifactIntentCorpusCategory;
  support: number;
  correct: number;
  accuracy: number | null;
  mismatches: number;
}

export interface ArtifactIntentEvaluation {
  total: number;
  correct: number;
  accuracy: number;
  confusion: ArtifactIntentConfusionMatrix;
  metrics: Record<ArtifactIntentEvaluationKind, ArtifactIntentKindMetrics>;
  categoryMetrics: Record<
    ArtifactIntentCorpusCategory,
    ArtifactIntentCategoryMetrics
  >;
  predictions: ArtifactIntentPrediction[];
  mismatches: ArtifactIntentPrediction[];
}

function createZeroCounts(): Record<ArtifactIntentEvaluationKind, number> {
  return {
    'incident-report': 0,
    'monitoring-analysis': 0,
    'server-monitoring-analysis': 0,
    'server-snapshot': 0,
    guidance: 0,
    none: 0,
  };
}

export function createEmptyConfusionMatrix(): ArtifactIntentConfusionMatrix {
  return {
    'incident-report': createZeroCounts(),
    'monitoring-analysis': createZeroCounts(),
    'server-monitoring-analysis': createZeroCounts(),
    'server-snapshot': createZeroCounts(),
    guidance: createZeroCounts(),
    none: createZeroCounts(),
  };
}

function calculateKindMetrics(
  confusion: ArtifactIntentConfusionMatrix,
  kind: ArtifactIntentEvaluationKind
): ArtifactIntentKindMetrics {
  const truePositive = confusion[kind][kind];
  const falsePositive = ARTIFACT_INTENT_EVALUATION_KINDS.reduce(
    (total, expected) =>
      expected === kind ? total : total + confusion[expected][kind],
    0
  );
  const falseNegative = ARTIFACT_INTENT_EVALUATION_KINDS.reduce(
    (total, predicted) =>
      predicted === kind ? total : total + confusion[kind][predicted],
    0
  );
  const support = truePositive + falseNegative;
  const predicted = truePositive + falsePositive;

  return {
    kind,
    support,
    predicted,
    truePositive,
    falsePositive,
    falseNegative,
    precision: predicted === 0 ? null : truePositive / predicted,
    recall: support === 0 ? null : truePositive / support,
  };
}

export function evaluateArtifactIntentClassifier(
  cases: readonly ArtifactIntentCorpusCase[],
  classify: (query: string) => ChatArtifactIntent
): ArtifactIntentEvaluation {
  const confusion = createEmptyConfusionMatrix();
  const predictions = cases.map((testCase) => {
    const result = classify(testCase.query);
    const predicted = result.kind;

    confusion[testCase.expected][predicted] += 1;

    return {
      id: testCase.id,
      query: testCase.query,
      category: testCase.category,
      note: testCase.note,
      expected: testCase.expected,
      predicted,
      ruleVersion: result.ruleVersion,
    };
  });
  const correct = predictions.filter(
    (prediction) => prediction.expected === prediction.predicted
  ).length;
  const metrics = Object.fromEntries(
    ARTIFACT_INTENT_EVALUATION_KINDS.map((kind) => [
      kind,
      calculateKindMetrics(confusion, kind),
    ])
  ) as Record<ArtifactIntentEvaluationKind, ArtifactIntentKindMetrics>;
  const categoryMetrics = Object.fromEntries(
    artifactIntentCorpusCategories.map((category) => {
      const categoryPredictions = predictions.filter(
        (prediction) => prediction.category === category
      );
      const correctInCategory = categoryPredictions.filter(
        (prediction) => prediction.expected === prediction.predicted
      ).length;

      return [
        category,
        {
          category,
          support: categoryPredictions.length,
          correct: correctInCategory,
          accuracy:
            categoryPredictions.length === 0
              ? null
              : correctInCategory / categoryPredictions.length,
          mismatches: categoryPredictions.length - correctInCategory,
        },
      ];
    })
  ) as Record<ArtifactIntentCorpusCategory, ArtifactIntentCategoryMetrics>;

  return {
    total: cases.length,
    correct,
    accuracy: cases.length === 0 ? 1 : correct / cases.length,
    confusion,
    metrics,
    categoryMetrics,
    predictions,
    mismatches: predictions.filter(
      (prediction) => prediction.expected !== prediction.predicted
    ),
  };
}

export function formatRatio(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(4);
}
