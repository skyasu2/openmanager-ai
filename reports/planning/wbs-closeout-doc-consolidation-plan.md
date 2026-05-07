# WBS & Closeout Documentation Consolidation 계획

> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-05-07
> Canonical: reports/planning/wbs-closeout-doc-consolidation-plan.md
> Tags: wbs,closeout,documentation,deliverables,dod

## 배경

현재 WBS와 종료 보고서 계열 문서는 총 4개가 남아 있다.

| 문서 | 경로 | 상태 | 역할 |
|------|------|------|------|
| 현행 WBS | `docs/reference/project/wbs.md` | Active Canonical | 모듈 기반 산출물 기준선 |
| 구 WBS | `reports/planning/archive/wbs.md` | Closed | v8.1.0 phase 기반 WBS 동결 스냅샷 |
| 최종 검수 확인서 | `reports/planning/archive/completion-review.md` | Closed | v8.1.0 종료/검수 보고서 |
| DoD Closeout Roadmap | `reports/qa/dod-closeout-roadmap.md` | Active | QA closeout 재오픈 조건 운영 가이드 |

구조 자체가 완전히 잘못된 것은 아니다. 문제는 active 사용자가 "현재 실질 산출물", "현재 완료 기준", "과거 종료 보고서", "현재 QA 상태"를 한 번에 판별하기 어렵다는 점이다.

특히 아래 drift가 있다.

- `docs/reference/project/wbs.md`는 176줄로 얇고, 일부 수치가 dead-code cleanup / chart migration 이전 기준일 가능성이 있다.
- `docs/reference/project/definition-of-done.md`는 active canonical이지만 Last reviewed와 하단 Last Updated가 다르다.
- `reports/qa/dod-closeout-roadmap.md`는 2026-03-09 기준 QA run 67회 상태를 포함하지만, 현재 `reports/qa/QA_STATUS.md`는 2026-05-07 기준 counted run 344회 / recorded run 418회를 표시한다.
- `reports/planning/archive/wbs.md`와 `completion-review.md`는 archive임에도 일부 canonical/link 문구가 과거 active path처럼 읽힐 수 있다.

## 웹 기준 비교

| 기준 | 공식/실무 근거 | 적용 판단 |
|------|----------------|-----------|
| WBS의 역할 | PMI는 WBS를 deliverable-oriented hierarchical decomposition으로 설명하며, 프로젝트 scope와 deliverables의 "what"을 정의하고 일정/방법의 "how/when"과 분리한다고 설명한다. <https://www.pmi.org/learning/library/practice-standard-work-breakdown-structures-8063> | 현행 WBS는 작업 로그가 아니라 산출물 인벤토리/범위 기준선이어야 함 |
| 100% Rule | PMI WBS 기준은 child level 합계가 parent scope의 100%여야 하며 범위 밖 작업을 포함하지 않아야 한다고 설명한다. <https://www.pmi.org/learning/library/applying-work-breakdown-structure-project-lifecycle-6979> | WBS에는 프로덕션 산출물과 필수 관리 산출물만 포함. archive 회고/QA run 세부내역은 제외 |
| DoD의 역할 | Scrum Guide는 Definition of Done을 Increment가 품질 기준을 충족한 상태의 formal description으로 정의하고, Done 여부의 shared understanding을 만든다고 설명한다. <https://scrumguides.org/scrum-guide.html> | `definition-of-done.md`가 active 완료 기준 SSOT여야 함 |
| 종료 보고서의 역할 | Atlassian project closure template은 산출물 완료, 성과 평가, lessons learned, stakeholder alignment, handover/archive를 문서화하는 구조를 제안한다. <https://www.atlassian.com/software/confluence/resources/guides/how-to/project-closure-template> | `completion-review.md`는 historical closure evidence로 유지. 현행 상태판 역할 금지 |
| 문서 유형 분리 | Diataxis는 reference가 제품/기계 자체의 사실을 중립적으로 설명해야 하며, 설명/방법/상태 문서와 섞지 말 것을 권장한다. <https://diataxis.fr/reference/> | WBS는 Reference, DoD는 Reference/Checklist, QA closeout은 How-to/Policy, status는 Status로 분리 |

## 목표 구조

정리 방향은 "문서 합본"이 아니라 "문서군 통합 맵 + SSOT 책임 분리"다.

```text
docs/reference/project/
├── requirements.md          # 요구사항: 제품이 무엇을 해야 하는가
├── wbs.md                   # 산출물 인벤토리: 무엇이 실제 산출물인가
└── definition-of-done.md    # 완료 기준: 어떤 품질 조건을 만족해야 Done인가

docs/status.md               # 사람이 읽는 릴리스/상태 스냅샷

reports/qa/
├── qa-tracker.json          # 최신 QA 상태 SSOT
├── QA_STATUS.md             # 자동 생성 QA 대시보드
└── dod-closeout-roadmap.md  # 유지 시: stale 숫자 없는 재오픈 정책만

reports/planning/archive/
├── wbs.md                   # v8.1.0 historical WBS, frozen
└── completion-review.md     # v8.1.0 historical completion report, frozen
```

## 적용 원칙

1. **WBS는 산출물 중심으로 유지한다.**
   - 일정, 회고, 상세 QA run, 추록성 설명은 넣지 않는다.
   - 각 산출물은 requirement, source path, evidence, DoD gate와 연결한다.

2. **종료 보고서는 active 상태판이 아니다.**
   - `completion-review.md`는 v8.1.0 공식 종료 증거로만 유지한다.
   - v8.11.x 이후 상태는 `docs/status.md`, `TODO.md`, `QA_STATUS.md`, `qa-tracker.json`으로 판단한다.

3. **DoD Closeout Roadmap은 숫자 스냅샷을 품지 않는다.**
   - live run count, completed/pending count는 `QA_STATUS.md`에만 둔다.
   - 유지한다면 "언제 QA closeout을 다시 열 것인가" 정책만 남긴다.
   - 더 깔끔한 대안은 해당 내용을 `definition-of-done.md`의 Release/QA Closeout 섹션으로 흡수하고 문서를 archive하는 것이다.

4. **완성도 %는 보조 설명으로만 둔다.**
   - WBS의 핵심은 deliverable coverage와 evidence link다.
   - 퍼센트는 신뢰 가능한 계산 기준이 없으면 status snapshot에만 제한하고, 현재 작업 판단 기준으로 쓰지 않는다.

## 권장 문서 책임

| 질문 | 봐야 할 문서 | 비고 |
|------|--------------|------|
| 제품이 해야 하는 일은 무엇인가? | `docs/reference/project/requirements.md` | FR/NFR 기준 |
| 실제 산출물은 무엇이고 어디에 구현되었나? | `docs/reference/project/wbs.md` | WBS Dictionary 형태 |
| Done으로 볼 품질 기준은 무엇인가? | `docs/reference/project/definition-of-done.md` | Feature/Bug/Release/QA closeout |
| 지금 열려 있는 작업은 무엇인가? | `reports/planning/TODO.md` | Active/Backlog/On Hold SSOT |
| 최신 QA 상태는 무엇인가? | `reports/qa/qa-tracker.json`, `reports/qa/QA_STATUS.md` | 자동/누적 상태 |
| 과거 v8.1.0 종료 근거는 무엇인가? | `reports/planning/archive/completion-review.md` | frozen evidence |

## 작업 범위

### Task 1: 현행 WBS를 WBS Dictionary로 재구성

- [ ] `docs/reference/project/wbs.md` 상단에 문서 책임과 SSOT 경계 추가
- [ ] 각 산출물 row를 아래 필드 중심으로 정리
  - WBS ID
  - 산출물명
  - 요구사항 링크
  - 주요 구현 경로
  - 검증/증거 경로
  - DoD gate
  - 상태
  - 재계산 트리거
- [ ] Dead code cleanup 이후 수치 재산정
- [ ] Chart migration 완료 후 chart 관련 산출물 재산정
- [ ] docs 수치 `55` 같은 stale 숫자를 현재 doc budget 결과와 맞추거나 제거

### Task 2: DoD 문서에 closeout 기준 통합

- [ ] `docs/reference/project/definition-of-done.md`의 버전/Last reviewed/Last Updated 불일치 정리
- [ ] Release DoD에 GitLab tag pipeline, Vercel production, Cloud Run, QA record 조건 반영
- [ ] QA Closeout/Reopen Criteria 섹션 추가
- [ ] `QA_STATUS.md`와 `qa-tracker.json`이 live QA SSOT임을 명시

### Task 3: DoD Closeout Roadmap 처리 결정

- [ ] 옵션 A: `reports/qa/dod-closeout-roadmap.md`를 stale 숫자 없는 policy-only 문서로 축소
- [ ] 옵션 B: 핵심 내용을 `definition-of-done.md`에 흡수하고 `reports/qa/archive/`로 이동
- [ ] 어떤 옵션이든 QA run count, pending count, latest run 같은 live 숫자는 제거
- [ ] 링크 사용자 검색을 위해 이전 경로에서 새 위치를 명확히 안내

### Task 4: Historical closeout 문서의 archive 성격 강화

- [ ] `reports/planning/archive/wbs.md`의 canonical/link 문구가 active path처럼 보이지 않게 정리
- [ ] `reports/planning/archive/completion-review.md` 상단에 frozen historical evidence임을 더 명확히 표시
- [ ] v8.11.x 현행 상태를 판단할 때 archive 문서를 기준으로 삼지 말라는 안내 추가
- [ ] archive 본문은 대규모 재작성하지 않음

### Task 5: 상태 문서 연결 정리

- [ ] `docs/status.md`에서 현재 기준 문서 목록에 `wbs.md`, `definition-of-done.md`를 명시
- [ ] `docs/status.md`의 완성도 문구가 archive completion-review를 live 기준처럼 보이게 하지 않는지 정리
- [ ] `TODO.md` Backlog와 새 plan 링크 정합성 유지

### Task 6: 검증

- [ ] `npm run docs:budget`
- [ ] `npm run docs:ai-consistency`
- [ ] `npm run docs:links:internal`
- [ ] `git diff --check`

## 제외 범위

- archive WBS/Completion Review 전체를 하나의 active 문서로 병합
- QA tracker나 QA run JSON 구조 변경
- WBS 점수를 근거 없는 새 퍼센트로 재산정
- Chart migration 구현 자체
- 새로운 `docs/reference/project/closeout.md` 생성

## 완료 기준

- [ ] active 독자가 "요구사항 / 산출물 / 완료 기준 / 현재 상태 / QA 상태 / 과거 종료 보고서"의 위치를 1분 안에 구분할 수 있다.
- [ ] `docs/reference/project/wbs.md`가 실제 산출물과 구현/검증 증거를 연결한다.
- [ ] `definition-of-done.md`가 release/QA closeout 기준을 포함한다.
- [ ] `reports/qa/dod-closeout-roadmap.md`가 stale 상태 숫자를 더 이상 품지 않거나 archive된다.
- [ ] archive 문서 2개는 frozen evidence로만 읽힌다.
- [ ] 문서 검증 4종이 통과한다.
