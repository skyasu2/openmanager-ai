> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-18
> Tags: ai,ux,frontend,analysis-basis-badge

# AnalysisBasisBadge 탭 UX 리팩토링 계획서

- 작성일: 2026-04-18
- 목표: AI 응답 하단 "분석 근거" 섹션을 사용자 친화적 과정 탭과 기술 상세 탭으로 분리해 가독성과 관측성을 동시에 확보한다.

---

## 배경 및 문제

현재 `AnalysisBasisBadge`(1050줄)는 확장 시 사용자용 정보와 디버그용 정보가 한 공간에 혼재한다.

| 항목 | 현재 위치 | 적합한 대상 |
|------|-----------|------------|
| 처리 경로 · 도구 한국어 요약 | 확장 패널 | 일반 사용자 ✅ |
| 처리 시간 · 지연 등급 | 확장 패널 | 일반 사용자 ✅ |
| traceId | 확장 패널 | 개발자 · 디버그 ❌ |
| handoffHistory 상세 | 확장 패널 | 개발자 · 디버그 ❌ |
| 실행 경로 기술명 | 확장 패널 | 개발자 · 디버그 ❌ |
| 디버그 번들 복사 버튼 | 확장 패널 | 개발자 · 디버그 ❌ |

## 해결 방향

확장 패널 내부에 **탭 전환** 추가. 모달/시트 열지 않고 같은 카드 공간에서 콘텐츠만 교체한다.

```
┌──────────────────────────────────────────────┐
│ 📊 분석 과정   [과정] [상세]         ▲       │  ← 헤더
├──────────────────────────────────────────────┤
│ [과정 탭]                                    │
│  서버 메트릭 확인 → 이상 탐지 → 원인 추정   │
│  처리 시간: 1.2초  ·  Multi 경로             │
├──────────────────────────────────────────────┤
│ [상세 탭]                                    │
│  trace: abc-123...               [복사]      │
│  handoff: 분석 조율 → 심층 분석 (2회)       │
│  실행 경로: NLQ Agent → Analyst Agent        │
└──────────────────────────────────────────────┘
```

---

## 계약 (Contract)

### 입출력 변경 없음
- `AnalysisBasisBadge` props 시그니처 변경 없음
- 외부에서 보이는 동작: 닫힌 상태 · 열린 상태 동일

### 탭 구성

**[과정] 탭** (기본 선택):
- 처리 경로 배지 + 설명 (현행 유지)
- 도구 결과 요약 — 한국어 label만, technicalName 배지 제거
- 처리 시간, 지연 등급, resolvedMode (사용자 친화적 텍스트)
- 참조 서버 목록

**[상세] 탭** (선택 시):
- traceId (monospace 코드블록)
- handoffHistory 상세 (에이전트 기술명, 단계, 이유)
- 실행 경로 기술명
- 디버그 번들 복사 버튼
- runtimeSummaryItems (ms 단위 raw 수치)

### 탭 상태 관리
- `useState<'process' | 'detail'>('process')` — 로컬 상태, 리셋 불필요
- 확장/축소 상태와 독립

### 테스트 시나리오
1. 기본 확장 시 [과정] 탭이 선택되어 있어야 한다
2. [상세] 클릭 시 traceId가 노출되어야 한다
3. [과정] 재클릭 시 traceId가 사라져야 한다
4. [과정] 탭에 technicalName 배지가 없어야 한다
5. 탭 전환 시 레이아웃 이동(CLS) 없어야 한다 (높이 고정 또는 min-height)
6. handoffHistory 없을 때 [상세] 탭에 "기술 정보 없음" 안내 노출

---

## Task 목록

- [x] `test(spec)`: AnalysisBasisBadge 탭 전환 failing tests 작성
- [x] `feat`: AnalysisBasisBadge에 탭 상태 및 탭 헤더 UI 추가
- [x] `feat`: [과정] 탭 콘텐츠 — technicalName 배지 제거, 사용자 친화적 항목만 유지
- [x] `feat`: [상세] 탭 콘텐츠 — traceId, handoffHistory, executionPath, 디버그 번들 이동
- [x] `fix`: 탭 전환 시 높이 안정성 확보 (min-height 또는 공통 높이 고정)
- [x] `test`: 테스트 통과 확인 + 기존 테스트 회귀 없음 확인
- [x] `chore`: TODO.md 완료 기록

---

## 변경 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/ai/AnalysisBasisBadge.tsx` | 탭 상태 추가, 탭 헤더 UI, 콘텐츠 분리 |
| `src/components/ai/AnalysisBasisBadge.test.tsx` | 탭 전환 시나리오 테스트 추가 |

`MessageDetailSheet`, `ThinkingProcessVisualizer`, `AIWorkspaceMessage`는 변경 없음.

---

## 비고

- `tool-presentation.ts`의 label/description 분리는 이미 완료 — [과정] 탭에서 바로 활용 가능
- 탭 UI는 shadcn `Tabs` 컴포넌트 사용 금지 (과도한 임포트). `button` + `className` 토글 방식으로 구현.
