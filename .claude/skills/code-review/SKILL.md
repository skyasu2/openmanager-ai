---
name: code-review
description: 6관점 심각도 우선 코드 리뷰. OpenManager 변경사항의 결함·회귀 리스크를 Correctness/Readability/Design/Performance/Security/Test Coverage 관점으로 분석하고 go/conditional/no-go 판정을 내린다. Use when the user asks for review, risk analysis, merge readiness, or regression hunting.
version: v1.0.0
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
disable-model-invocation: true
---

# Code Review

6개 관점으로 실제 결함과 릴리즈 리스크를 우선 발굴합니다.

## Trigger Keywords

- "/code-review", "/review"
- "코드 리뷰", "리뷰해줘", "머지 가능해?", "회귀 확인"
- "risk analysis", "go/no-go"

## Review Perspectives (6관점)

| # | 관점 | 핵심 체크 |
|---|------|----------|
| 1 | **Correctness** | 요구사항 충족, 로직 결함, 회귀, 상태 경쟁, null/error 누락 경로 |
| 2 | **Readability** | 네이밍, 구조, 불필요한 복잡도, 오해를 유발하는 추상화 |
| 3 | **Design** | SRP, DRY, 적절한 추상화 수준, 숨겨진 결합 |
| 4 | **Performance** | 시간/공간 복잡도, 불필요한 연산, 페이로드 비대, 비싼 기본값 |
| 5 | **Security** | OWASP Top 10, 인증 갭, 권한 범위, 시크릿 누출, 신뢰 경계 |
| 6 | **Test Coverage** | 커버리지 갭, 엣지케이스, 테스트 품질, 크리티컬 브랜치 누락 |

## Workflow

1. 리뷰 범위 확인.
- `git status --short`
- `git diff --name-only`
- 범위가 크면 이번 작업에서 수정된 파일과 직접 연관 파일에 집중

2. 실행 증거 수집.
- 변경 영역 대상 테스트를 먼저 실행: `npm run test:quick`
- 핵심 동작이 변경됐으나 대상 테스트가 없으면 최소 1개 이상 안전 체크 수행
- 커맨드 증거 없이 "안전함"을 주장하지 않음

3. 범위 적응형 관점 적용.
- **코드 변경**: 6개 관점 전체 적용
- **설정/문서 변경**: Correctness + Readability + Design 집중, Security/Performance는 관련 시에만

4. 각 발견사항에 심각도 부여.
- `P0` 릴리즈 블로커: 보안 익스플로잇, 데이터 손실, 하드 아웃지
- `P1` 고위험: 일반 사용자 경로 회귀, API 계약 파괴
- `P2` 중위험: 엣지케이스 실패, UX 저하, 운영 마찰
- `P3` 저위험: 명확성/테스트 부채/비차단 개선
- 에스컬레이션: 영향 불명확하나 blast radius가 넓으면 한 단계 상향

5. 증거와 함께 발견사항 보고.
- 각 발견사항: 심각도, 관점, 파일 경로 + 라인, 사용자 영향, 최소 수정 방향
- 발견사항 없으면 명시 후 잔여 리스크/테스트 갭 목록화

6. 릴리즈 판정.
- `go`: P0/P1 없음, 불명확한 미지수 없음
- `conditional`: P2/P3만, 명확한 후속 조치 있음
- `no-go`: 미해결 P0/P1 또는 크리티컬 테스트 증거 누락

충분한 증거 기준:
- 코드 변경: 관련 테스트 최소 1개 통과 또는 수동 검증 기록
- 설정 변경: 변경 전후 동작 일관성 확인
- 증거 없이 "go" 판정 금지

## Output Format

```text
Code Review Findings

Perspective Summary
- Correctness: <count> findings
- Readability: <count> findings
- Design: <count> findings
- Performance: <count> findings
- Security: <count> findings
- Test Coverage: <count> findings

Findings
- [P1][Security] <제목>
  file: <경로:라인>
  impact: <누가 어떻게 영향받는지>
  fix: <최소 조치 방향>

Open Questions / Assumptions
- <있으면 기재>

Validation Evidence
- <커맨드>: pass|fail|not run

Release Decision
- go | conditional | no-go
- rationale: <한 문장>
```

## Related Skills

- `lint-smoke` - 리뷰 전 기본 품질 체크
- `git-workflow` - 리뷰 후 커밋/푸시

## Changelog

- 2026-03-19: v1.0.0 - Codex openmanager-code-review 이식, Claude Code 포맷 적용
