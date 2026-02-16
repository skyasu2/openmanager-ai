---
name: lint-smoke
description: Run fast quality smoke checks for OpenManager before commit or deploy. Use when validating changed code quickly.
version: v1.4.0
user-invocable: true
allowed-tools: Bash, Read, Grep
---

# Lint Smoke

빠른 품질 확인용 스모크 체크입니다. 리뷰를 대체하지 않으며, 실행 증거 수집이 목적입니다.

## Trigger Keywords

- "lint"
- "smoke check"
- "품질 체크"
- "사전 검증"

## Workflow

1. 변경 범위 확인.
- `git status --short`
- 코드 변경이 없고 문서만 변경이면 경량 체크만 수행

2. 루트 스모크 체크 실행.
- `npm run test:quick`
- `npm run type-check`
- `npm run lint`

3. `cloud-run/ai-engine` 변경 시 추가 체크.
- `cd cloud-run/ai-engine && npm run type-check`
- `cd cloud-run/ai-engine && npm run test`

4. 결과 보고.
- 성공/실패 명령 분리
- 실패 시 다음 조치 명령을 한 줄로 제시

5. 리뷰 요청이 있으면 리뷰 스킬로 연결.
- 스모크 체크는 결함 분석이 아님
- 리뷰 요청 시 `code-review` 스킬 기준으로 severity 보고 수행

## Output Format

```text
Lint Smoke Summary
- test:quick: pass|fail
- type-check: pass|fail
- lint: pass|fail
- ai-engine checks: skipped|pass|fail
- ready to commit: yes|no
```

## Changelog

- 2026-02-16: v1.4.0 - v1.1.0에서 전면 재작성 (220행→56행), 공개용 톤 정리, 리뷰 스킬 연계 명시
  - v1.2.x (2025-12): Vitest 4.0, Biome 전환 반영 (이력 통합)
  - v1.1.0 (2025-11): 트리거 키워드 확장, 자동수정 로직 추가
