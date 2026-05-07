---
name: lint-smoke
description: Run fast quality smoke checks for OpenManager before commit or deploy. Use when validating changed code quickly.
version: v1.6.1
user-invocable: true
allowed-tools: Bash, Read, Grep
disable-model-invocation: true
---

# Lint Smoke

> Common baseline: before editing this skill, review `docs/guides/ai/skill-standards.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

빠른 품질 확인용 스모크 체크입니다. 리뷰를 대체하지 않으며, 실행 증거 수집이 목적입니다.

## Testing Methodology

- 기준 SSOT는 `docs/guides/testing/test-strategy.md` 입니다.
- 기본 smoke는 Risk-Based Local-First로, 변경된 위험 표면에 필요한 최소 고신뢰 로컬 체크만 실행합니다.
- 기본 smoke에 실 LLM, Supabase, Vercel, Cloud Run, Redis, GCP 등 외부 서비스 호출을 추가하지 않습니다.
- coverage percentage를 맞추기 위한 테스트 추가를 금지하고, false-pass 테스트는 추가보다 수정/삭제를 우선합니다.

## Trigger Keywords

- "/lint-smoke", "lint"
- "smoke check"
- "품질 체크"
- "사전 검증"

## Workflow

1. 변경 범위 확인.
- `git status --short`
- `git diff --name-only HEAD~1` (최근 변경 파일 목록)
- 코드 변경이 없고 문서만 변경이면 경량 체크만 수행

2. 루트 스모크 체크 실행.
- `npm run test:quick` — Vitest 빠른 suite
- `npm run type-check` — TypeScript strict
- `npm run lint` — Biome
- Large/live 테스트가 필요한 신뢰도는 smoke에 섞지 말고 별도 opt-in QA 필요로 보고

3. QA 스크립트 변경 시 node suite 추가 실행.
- 대상: `scripts/qa/**`, `tests/unit/qa/**` 변경 시
- `npm run test:node` — node 전용 suite (build-validation-evidence 등)

4. `cloud-run/ai-engine` 변경 시 추가 체크.
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`

5. 결과 보고.
- 성공/실패 명령 분리
- 실패 시 다음 조치 명령을 한 줄로 제시

6. 리뷰 요청이 있으면 `code-review` 스킬로 연결.
- 스모크 체크는 결함 분석이 아님
- 리뷰 요청 시 `code-review` 스킬로 위임 (7관점 심각도 우선 분석)

## Output Format

```text
Lint Smoke Summary
- test:quick: pass | fail
- type-check: pass | fail
- lint: pass | fail
- test:node: skipped | pass | fail (QA script 변경 시)
- ai-engine checks: skipped | pass | fail
- ready to commit: yes | no
```

## Related Skills

- `code-review` - 7관점 심각도 우선 코드 리뷰 (리뷰 요청 시 스모크 후 연계)
- `git-workflow` - 스모크 통과 후 커밋/푸시
- `qa-ops` - Vercel/local 최종 QA + `reports/qa` 누적 기록

## Changelog

- 2026-02-16: v1.4.0 - v1.1.0에서 전면 재작성, 공개용 톤 정리, 리뷰 스킬 연계 명시
- 2026-02-26: v1.5.0 - 최종 QA는 `qa-ops` 스킬로 누적 추적 원칙 추가
- 2026-04-03: v1.6.0 - QA 스크립트 변경 시 `npm run test:node` 추가, 변경 파일 확인 단계 보강
- 2026-05-07: v1.6.1 - Risk-Based Local-First smoke 기준과 external/live 테스트 제외 원칙 반영
