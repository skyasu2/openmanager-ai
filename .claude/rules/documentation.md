---
paths:
  - "docs/**"
  - "reports/**"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "GEMINI.md"
  - ".claude/rules/**"
  - ".agents/skills/**"
---

# Documentation Rules (SSOT)

> 문서 정책의 단일 기준은 이 파일이다. `AGENTS.md`와 Skill 문서는 이 규칙을 따라 동기화한다.

## 1) Doc Budget Policy

> **우선순위**: 병합 > 기존 문서 확장 > 신규 생성

| 범위 | 한도 | 비고 |
|------|:----:|------|
| 전체 활성 문서 | 90개 | `docs/archived/` 제외 |
| architecture/* | 12개 | 시스템 전체 아키텍처 정리본 |
| design/* | 12개 | 모듈/기능 상세 설계 |
| operations/* | 8개 | 운영 진입점과 runbook |
| adr/* | 8개 | 현재 의사결정 기록 |
| reference/architecture/* | 28개 | 상세 아키텍처 문서 |
| development/* | 28개 | vibe-coding/ 포함 |
| guides/* | 14개 | 운영 지침 |
| troubleshooting/* | 7개 | 문제 해결 |
| root (docs/) | 5개 | README, QUICK-START 등 |

## 1-1) 파일 길이 기준

> 근거: **"Lost in the Middle" (Liu et al., TACL 2024)** — LLM은 긴 문서에서 관련 정보가 중간에 있을 때 성능이 떨어질 수 있다. 줄 수 제한은 코드 품질 규칙(ESLint max-lines)이 아니라 AI 인지 손실 방지 기준이다.

| 구간 | 처리 | AI 인지 영향 |
|------|------|-------------|
| ≤ 600줄 | 무조건 허용 | 손실 없음 |
| 601 ~ 1200줄 | 허용. 중요 내용을 **앞부분에 배치** | 중간 손실 시작 구간 |
| > 1200줄 | **분할 권고** — 별개 참조 단위인지 확인 | "Lost in the Middle" 실질 위험 |

**분할 판단 기준**: 줄 수가 아니라 **별개 독자, 별개 작업, 또는 별개 참조 단위** 여부.
- Tutorial/How-to: 400줄 이하 권장. 401~600줄은 같은 작업 흐름이면 허용
- Reference/Architecture: 완결성 우선. 1200줄 초과 시 섹션별 별도 파일 검토
- Explanation: 300~600줄 권장. 하나의 Why 질문을 벗어나면 분할
- **AI가 읽는 문서 공통**: 핵심 내용(요약·결론·금지사항)은 항상 문서 **앞 1/3** 에 배치
- 분할 시 원본 파일에 링크 유지 필수

## 2) Metadata Schema (Changed Docs Hard Gate)

신규/수정 문서는 아래 메타데이터를 문서 상단 인용 블록으로 포함한다.

```text
> Owner: team-or-person
> Status: Active Canonical | Active Supporting | Historical | Deprecated | Archived | Draft
> Doc type: Tutorial | How-to | Reference | Explanation
> Last reviewed: YYYY-MM-DD
> Canonical: docs/path.md | n/a
> Tags: comma,separated,tags
```

필수/선택:
- 필수: `Owner`, `Status`, `Doc type`, `Last reviewed`
- 선택: `Canonical`, `Tags`
- 호환: 기존 `Last verified`는 임시 호환 필드로 허용한다. 신규 문서는 `Last reviewed`를 사용한다.

보완 규칙:
- `Status != Active Canonical`인 문서는 `Canonical` 필드를 권장한다.
- 디렉토리 `README.md`에 링크가 없는 문서는 운영 기준에서 제외한다.

## 3) Rollout Policy

- Hard gate: 이번 변경으로 추가/수정된 활성 문서(`docs/archived/` 제외)
- Warn only: 레거시 미수정 문서
- 90일 이상 미갱신 활성 문서는 아카이브 후보로 경고한다.

## 4) Diataxis 분류 기준

| 유형 | 목적 | 예시 |
|------|------|------|
| Tutorial | 학습(따라하기) | QUICK-START.md |
| How-to | 문제 해결 절차 | docker.md, git-hooks-workflow.md |
| Reference | 사실/명세 조회 | endpoints.md, architecture docs |
| Explanation | 배경/설계 맥락 | coding-standards.md, project-evolution.md |

## 4-1) 제목 규칙

### 파일명 (kebab-case)
- 동사 금지: `how-to-deploy.md` ❌ → `deployment-guide.md` ✅
- 번호 접두사는 순서가 중요한 경우만: `01-system-overview.md`
- 타입 접미사 불필요: `api-reference-doc.md` ❌ → `api-reference.md` ✅
- ADR: 반드시 `adr-NNN-kebab-title.md` 형식

### 문서 H1 제목 (Diataxis 유형별 패턴)

| 유형 | 패턴 | 예시 |
|------|------|------|
| Tutorial | `X 시작 가이드` / `X 빠른 시작` | `OpenManager AI 빠른 시작 가이드` |
| How-to | `X 가이드` / `X 운영` | `Docker 개발 환경 가이드` |
| Reference | `X 레퍼런스` / `X 아키텍처` / `X 설계` | `AI Engine Architecture` |
| Explanation | `X — Y` (주제 — 부제) | `프로젝트 변천사 — 테세우스의 배` |
| ADR | `ADR-NNN: 결정 한 줄 요약` | `ADR-004: Vercel AI SDK — LangChain 대신 선택한 이유` |

### 금지 패턴
- 모호한 제목: `Overview.md`, `Notes.md`, `Misc.md`
- 날짜 접두사 파일명: `2026-05-20-analysis.md` → `reports/` 에 넣거나 ADR로
- 영어/한국어 혼용 제목: H1은 단일 언어로 (한국어 우선, 고유명사 영어 허용)

## 5) 자동화 계약

- `npm run docs:check`: 품질 점검 + 예산 리포트 생성
- `npm run docs:budget:strict`: 변경 문서 메타데이터 누락/예산 초과 시 실패
- `npm run docs:ai-consistency`: AI 운영 문서의 MCP/Skills stale guidance 차단
- CI는 `DOCS_DIFF_RANGE`로 PR/Push 기준 변경 파일 집합을 전달한다.
- 예산 리포트는 `PASS|WARN|FAIL`, `rule_id`, `file`, `action_hint`를 출력한다.

## 6) 금지사항

- 분석/리뷰 문서를 `docs/` 루트에 생성
- 완료된 Historical 문서를 활성 경로에 방치
- Diataxis 라벨 없이 신규 문서 생성
- 동일 주제를 작은 파일로 과분할

## 7) Best-Practice Alignment Baseline

- Diataxis: https://diataxis.fr/
- Docs-as-Code (Write the Docs): https://www.writethedocs.org/guide/docs-as-code/
- Google Developer Documentation Style Guide: https://developers.google.com/style
- Microsoft Docs metadata guidance: https://review.learn.microsoft.com/en-us/help/platform/metadata
- "Lost in the Middle" — AI 문서 크기 기준 근거 (TACL 2024): https://arxiv.org/abs/2307.03172

---

See also: `docs/development/documentation-management.md`
