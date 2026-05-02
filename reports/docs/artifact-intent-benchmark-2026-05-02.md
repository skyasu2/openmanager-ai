# Artifact Intent Local Classifier Evaluation 2026-05-02

- Rule version: `2026-05-02-v2`
- Corpus: `tests/fixtures/artifacts/intent-corpus.ts`
- Evaluation: `tests/intent-classifier/intent-classifier.eval.test.ts`
- Benchmark wrapper: `tests/artifacts/intent-classifier.bench.ts`
- Command: `npx vitest run --config config/testing/vitest.config.main.ts tests/intent-classifier/intent-classifier.eval.test.ts tests/artifacts/intent-classifier.bench.ts --reporter verbose`
- Result: passed, `112/112` correct
- Policy note: broad symptom + analysis phrases such as `현재 서버 상태 분석해줘`,
  `서버 분석해줘`, and `CPU 높은 서버 원인 분석해줘` are treated as `none`
  unless the user explicitly asks for an artifact-shaped output.
- Snapshot policy note: `server-snapshot` is intentionally regex-only and
  client-only. It requires both a server/infrastructure status subject and an
  artifact-shaped token such as `스냅샷`, `상태 카드`, `상태 리포트`,
  `다운로드`, or `export`; broad status questions stay in normal chat.
- Scope note: this evaluation covers the deterministic local classifier only.
  Runtime LLM fallback through `/api/ai/artifact-intent` remains scoped to
  incident report and monitoring analysis candidates and is not part of this
  local precision score.

## Precision/Recall

| Kind | Support | Predicted | True positive | False positive | False negative | Precision | Recall |
|------|--------:|----------:|--------------:|---------------:|---------------:|----------:|-------:|
| `incident-report` | 18 | 18 | 18 | 0 | 0 | 1.0000 | 1.0000 |
| `monitoring-analysis` | 18 | 18 | 18 | 0 | 0 | 1.0000 | 1.0000 |
| `server-snapshot` | 8 | 8 | 8 | 0 | 0 | 1.0000 | 1.0000 |
| `guidance` | 30 | 30 | 30 | 0 | 0 | 1.0000 | 1.0000 |
| `none` | 38 | 38 | 38 | 0 | 0 | 1.0000 | 1.0000 |

## Category Coverage

| Category | Support | Correct | Mismatches | Accuracy |
|----------|--------:|--------:|-----------:|---------:|
| `explicit-action` | 16 | 16 | 0 | 1.0000 |
| `implicit-artifact` | 4 | 4 | 0 | 1.0000 |
| `snapshot-artifact` | 8 | 8 | 0 | 1.0000 |
| `guidance-question` | 20 | 20 | 0 | 1.0000 |
| `negation` | 16 | 16 | 0 | 1.0000 |
| `operational-chat` | 17 | 17 | 0 | 1.0000 |
| `ambiguous-chat` | 3 | 3 | 0 | 1.0000 |
| `navigation` | 6 | 6 | 0 | 1.0000 |
| `mixed-language` | 22 | 22 | 0 | 1.0000 |

## Confusion Matrix

| Expected \ Predicted | `incident-report` | `monitoring-analysis` | `server-snapshot` | `guidance` | `none` |
|----------------------|------------------:|----------------------:|------------------:|-----------:|-------:|
| `incident-report` | 18 | 0 | 0 | 0 | 0 |
| `monitoring-analysis` | 0 | 18 | 0 | 0 | 0 |
| `server-snapshot` | 0 | 0 | 8 | 0 | 0 |
| `guidance` | 0 | 0 | 0 | 30 | 0 |
| `none` | 0 | 0 | 0 | 0 | 38 |

## Guard

- `incident-report` local classifier precision threshold: `>= 0.94`
- `monitoring-analysis` local classifier precision threshold: `>= 0.94`
- `server-snapshot` local classifier precision threshold: `>= 0.94`
- All five local classifier classes must keep the recorded minimum support and
  maintain precision/recall `>= 0.90` to catch guidance/none drift.
- All corpus categories must keep the recorded minimum support and maintain
  accuracy `>= 0.90`.
- The evaluation is included in `test:quick` through `config/testing/vitest.config.minimal.ts`.
