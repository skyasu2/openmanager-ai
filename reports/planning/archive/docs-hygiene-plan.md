# docs 위생 개선 계획 (2026-05-08)

> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-08
> Canonical: reports/planning/archive/docs-hygiene-plan.md
> Tags: docs,hygiene,budget,diataxis

## 배경

2026-05-08 `docs/` 전체 제목 기반 분석 결과:
- 활성 문서 **72개** (한도 90, 여유 18) after Task 2 archive move
- 유사/중복 의심 그룹 3개 발견
- 장문 파일(500줄 초과) 5개 — 정책 기준과 대조 필요
- MEMORY.md에 기록된 활성 문서 수(56개)가 실제와 불일치 → 갱신 필요

### 웹 조사 결과 요약 (Diataxis + Google/Microsoft/Write the Docs)

| 문서 유형 | 적정 길이 | 이유 |
|---|---|---|
| Tutorial | ≤ 400줄 | 학습 흐름 유지, 완독 필요 |
| How-to | ≤ 300줄 | 목표 1개 = 파일 1개, 짧고 집중 |
| Reference | 제한 없음 (완결성 우선) | 비선형 탐색, 완결성이 가치 |
| Explanation | 300~800줄 | Why 질문 1개 단위 |

**핵심 결론**: 500줄 단일 기준은 합리적이지 않음.
현재 프로젝트의 `≤800 정상 / 801~1500 허용 / >1500 분할 검토` 기준은 업계 표준에 부합.
**분할 판단은 줄 수가 아닌 "별개 독자 또는 별개 작업" 단위가 기준.**

---

## 현황 스냅샷 (2026-05-08)

### 카테고리별 실제 vs 한도

| 카테고리 | 실제 | 한도 | 여유 |
|---|---|---|---|
| `reference/` | 21 | 28 | 7 |
| `development/` | 18 | 28 | 10 |
| `guides/` | 8 | 14 | 6 |
| `design/` | 6 | 12 | 6 |
| `architecture/` | 6 | 12 | 6 |
| `adr/` | 4 | 8 | 4 |
| `operations/` | 3 | 8 | 5 |
| `troubleshooting/` | 2 | 7 | 5 |
| `root` | 4 | 5 | 1 |
| **합계** | **72** | **90** | **18** |

### 500줄 초과 파일

| 파일 | 줄수 | 유형 | 조치 |
|---|---|---|---|
| `reference/architecture/ai/ai-engine-architecture.md` | 1239 | Reference | 분할 평가 필요 |
| `docs/archived/ai-assistant-initial-design-comparison.md` | 889 | Historical | archived 이동 완료 |
| `development/ci-cd.md` | 722 | Reference/How-to 혼합 | 중복 섹션 검토 |
| `reference/architecture/system/system-architecture-current.md` | 563 | Reference | 유지 (완결성) |
| `development/dev-tools.md` | 539 | Reference | 유지 (완결성) |

---

## Task 목록

### Task 1 — MEMORY.md 문서 수 갱신
- [x] repo-local `MEMORY.md` 대상 확인 — 파일 없음 (`find . -iname '*memory*'` 기준)
- [x] "활성 56개" 기록 위치 재검색 — repo-local Markdown 기준 실제 수정 대상 없음
- [x] 한도 표기 `90`은 `.claude/rules/documentation.md`, `docs/development/documentation-management.md`, docs budget 출력 기준 일치 확인

### Task 2 — `ai-assistant-initial-design-comparison.md` archived 이동
**근거**: 최초 설계 비교·의사결정 이력 문서(Historical). 889줄로 현 운영 참조 가치 낮음.

- [x] 내용 검토 — Option A 유지, deterministic/single-first, artifact/fact boundary 결론은 현재 `ai-engine-architecture.md`에 이미 반영됨. 추가 ADR 생성 불필요
- [x] 파일 이동: `reference/architecture/ai/ai-assistant-initial-design-comparison.md` → `docs/archived/ai-assistant-initial-design-comparison.md`
- [x] 링크하는 파일은 active SSOT 중심으로 정리하고 historical reference만 archived 경로로 보정

### Task 3 — `frontend-backend-comparison.md` 중복 검토
**근거**: `ai-engine-architecture.md`와 내용 겹침 의심 (382줄).

- [x] 두 파일 H2 섹션 대조 — `frontend-backend-comparison.md`는 책임 경계/파일 매핑/완성도 비교, `ai-engine-architecture.md`는 runtime/provider/tool/fallback 상세 기준
- [x] 중복 비율 70%+ → 해당 없음. 섹션 목적 기준 중복률 70% 미만으로 판단
- [x] 중복 비율 <70% → `See Also` 링크와 문서 관계 설명 추가 후 유지

### Task 4 — `development/ci-cd.md` 중복 섹션 검토
**근거**: 722줄 How-to/Reference 혼합. `operations/deployment-guide.md`와 배포 절차 중복 가능.

- [x] `ci-cd.md`와 `deployment-guide.md` 섹션 비교 — 중복은 `ci-cd.md` Part 3 배포 전략 구간에 집중
- [x] 중복 섹션 → `deployment-guide.md`를 배포 절차 SSOT로 유지하고 `ci-cd.md`는 pipeline/권한/변수 reference로 축소
- [x] How-to(절차)와 Reference(파이프라인 구조) 섹션 명확히 분리 — `ci-cd.md` Doc type을 Reference로 보정

### Task 5 — `ai-engine-architecture.md` 분할 평가
**근거**: 1239줄. 현재 한도(>1500 분할 검토) 이하이나 독자 단위 점검 필요.

- [x] 파일 내 섹션별 독자 페르소나 식별
  - AI 엔진 운영자(배포/설정) vs 개발자(코드 구조) vs 아키텍트(설계 결정)
- [x] 독자가 3개 이상으로 뚜렷이 분리되면 분할 계획 수립 — 해당 없음. 운영 절차는 Operations/Deployment Guide로 이미 분리됨
- [x] 독자가 1~2개면 → 유지 (Reference 완결성 원칙 적용) — 개발자/아키텍트용 runtime canonical reference로 유지, 상단에 분할 판단 메모 추가

### Task 6 — `documentation.md` 규칙 파일 길이 기준 명확화
**현행**: `≤800 정상 / 801~1500 허용 / >1500 분할 검토`
**웹 조사 결과**: 현행 기준이 업계 표준에 부합. 단, 유형별 차등 기준 명시가 없음.

- [x] `.claude/rules/documentation.md` § 1-1 파일 길이 기준에 Diataxis 유형별 권고 추가:
  ```
  - Tutorial/How-to: ≤400줄 권장 (완독 흐름 유지)
  - Reference: 제한 없음 — 완결성이 기준
  - Explanation: 300~800줄 권장
  - 분할 판단: 줄 수보다 "별개 독자 또는 별개 작업" 단위 우선
  ```
- [x] `docs/development/documentation-management.md` 동기화

---

## 검증 기준

- [x] `npm run docs:budget` → PASS (72/90 after Task 2 archive move)
- [x] archived 이동 후 링크 깨짐 없음 (`rg --no-ignore "ai-assistant-initial-design-comparison" docs/`)
- [x] MEMORY.md 수치 정확성 확인 — repo-local `MEMORY.md` 없음, "활성 56개" 수정 대상 없음

---

## 우선순위 순서

1. Task 1 (MEMORY 갱신) — 5분, 즉시 가능
2. Task 6 (정책 명확화) — 10분, 웹 조사 결과 반영
3. Task 2 (archived 이동) — 30분, 내용 검토 필요
4. Task 3 (중복 검토) — 20분
5. Task 4 (ci-cd 정리) — 30분
6. Task 5 (분할 평가) — 별도 판단 필요, 낮은 우선순위
