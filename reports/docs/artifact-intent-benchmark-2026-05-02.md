# Artifact Intent Local Classifier Evaluation 2026-05-02

- Rule version: `2026-05-02-v1`
- Corpus: `tests/fixtures/artifacts/intent-corpus.ts`
- Evaluation: `tests/intent-classifier/intent-classifier.eval.test.ts`
- Benchmark wrapper: `tests/artifacts/intent-classifier.bench.ts`
- Command: `npx vitest run --config config/testing/vitest.config.main.ts tests/intent-classifier/intent-classifier.eval.test.ts tests/artifacts/intent-classifier.bench.ts --reporter verbose`
- Result: passed, `102/102` correct
- Policy note: broad symptom + analysis phrases such as `현재 서버 상태 분석해줘`,
  `서버 분석해줘`, and `CPU 높은 서버 원인 분석해줘` are treated as `none`
  unless the user explicitly asks for an incident report artifact.
- Scope note: this evaluation covers the deterministic local classifier only.
  Runtime LLM fallback through `/api/ai/artifact-intent` is guarded by route
  tests and is not part of this local precision score.

## Precision/Recall

| Kind | Support | Predicted | True positive | False positive | False negative | Precision | Recall |
|------|--------:|----------:|--------------:|---------------:|---------------:|----------:|-------:|
| `incident-report` | 18 | 18 | 18 | 0 | 0 | 1.0000 | 1.0000 |
| `monitoring-analysis` | 18 | 18 | 18 | 0 | 0 | 1.0000 | 1.0000 |
| `guidance` | 30 | 30 | 30 | 0 | 0 | 1.0000 | 1.0000 |
| `none` | 36 | 36 | 36 | 0 | 0 | 1.0000 | 1.0000 |

## Category Coverage

| Category | Support | Correct | Mismatches | Accuracy |
|----------|--------:|--------:|-----------:|---------:|
| `explicit-action` | 16 | 16 | 0 | 1.0000 |
| `implicit-artifact` | 4 | 4 | 0 | 1.0000 |
| `guidance-question` | 19 | 19 | 0 | 1.0000 |
| `negation` | 15 | 15 | 0 | 1.0000 |
| `operational-chat` | 17 | 17 | 0 | 1.0000 |
| `ambiguous-chat` | 3 | 3 | 0 | 1.0000 |
| `navigation` | 6 | 6 | 0 | 1.0000 |
| `mixed-language` | 22 | 22 | 0 | 1.0000 |

## Confusion Matrix

| Expected \ Predicted | `incident-report` | `monitoring-analysis` | `guidance` | `none` |
|----------------------|------------------:|----------------------:|-----------:|-------:|
| `incident-report` | 18 | 0 | 0 | 0 |
| `monitoring-analysis` | 0 | 18 | 0 | 0 |
| `guidance` | 0 | 0 | 30 | 0 |
| `none` | 0 | 0 | 0 | 36 |

## Guard

- `incident-report` local classifier precision threshold: `>= 0.94`
- `monitoring-analysis` local classifier precision threshold: `>= 0.94`
- All four local classifier classes must keep the recorded minimum support and
  maintain precision/recall `>= 0.90` to catch guidance/none drift.
- All corpus categories must keep the recorded minimum support and maintain
  accuracy `>= 0.90`.
- The evaluation is included in `test:quick` through `config/testing/vitest.config.minimal.ts`.
