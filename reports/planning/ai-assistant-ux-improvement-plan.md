> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-17
> Tags: ai-assistant, ux, frontend, chat, sidebar

# AI 어시스턴트 UX 개선 계획서

**작성 일자**: 2026-05-17  
**분석 범위**: AI 어시스턴트 사이드바 + 전체 페이지 (`/dashboard/ai-assistant`)  
**비교 기준**: ChatGPT, Claude.ai 디자인 패턴 및 UX 관행

---

## 구현 담당

**Codex** — 코드 수정 · 검증 · 커밋 전담

```bash
bash scripts/ai/agent-bridge.sh --to codex \
  "reports/planning/ai-assistant-ux-improvement-plan.md 계획서를 읽고 우선순위대로 Task를 구현해줘."
```

---

## 현재 상태 분석

### 화면 구성 (2026-05-17 스크린샷 기준)

```
전체 페이지 (/dashboard/ai-assistant)
├── 대시보드 좌측 아이콘 nav (개요/서버/알림/로그/토폴로지)
├── 페이지 헤더: "AI 어시스턴트" + 부제
├── 기능 탭: [AI Chat] [장애 보고서] [이상감지/추세] ... [컨텍스트]
├── 섹션 헤더: "AI Chat / AI 기반 대화형 인터페이스"   ← 중복
├── 채팅 영역
│   ├── 웰컴: 봇 아이콘 + "무엇을 도와드릴까요?" + 2x2 카드
│   └── 대화 중: 사용자 버블(파랑) + AI 텍스트 + 분석근거 아코디언
└── 입력창: [+] [textarea] [전송]

사이드바 (대시보드 우측)
└── 미니 패널: AI 기능 아이콘 + 웰컴 텍스트(세로 줄바꿈) + 입력창
```

### ChatGPT · Claude 대비 GAP 분석

| 영역 | ChatGPT / Claude | 현재 프로젝트 | 개선 필요도 |
|------|-----------------|--------------|:----------:|
| 레이아웃 단계 | 1단 헤더 + 채팅 | 4단 헤더 중첩 | 🔴 High |
| 웰컴 화면 | 브랜드 개성 있음 | ChatGPT 패턴 클론 | 🟠 Medium |
| AI 메시지 버블 | 명확한 배경 구분 | 배경 없이 텍스트만 | 🟠 Medium |
| 기능 전환 방식 | 단일 스트림 + slash | 3개 탭 (컨텍스트 단절) | 🔴 High |
| 분석 근거 표시 | 인라인 접기 가능 | 항상 노출 (채팅 흐름 방해) | 🟠 Medium |
| 스크롤 복귀 | ↓ 고정 버튼 있음 | 없음 | 🟡 Low |
| 에이전트 표시 | 모델명 표시 | 없음 | 🟡 Low |
| 사이드바 미니뷰 | 아이콘만 or 슬라이드 | 텍스트 세로 줄바꿈 | 🔴 High |
| 대화 이력 | 좌측 히스토리 | 없음 | 🟡 Low |
| 메시지 재생성 | 있음 | 있음(다시 생성) | ✅ |
| 복사 버튼 | 있음 | 있음(복사) | ✅ |
| 마크다운 렌더링 | 있음 | 있음 | ✅ |
| 분석 근거 투명성 | 없음 | 있음 (차별화 강점) | ✅ 유지 |

---

## 개선 Task 목록

| # | Task | 핵심 변경 | 우선순위 | 예상 소요 |
|---|------|----------|---------|---------|
| T1 | 사이드바 미니뷰 줄바꿈 수정 | 최소 너비 + 텍스트 처리 | High | 30분 |
| T2 | 헤더 레이어 단순화 | 4단 → 2단 헤더 | High | 1시간 |
| T3 | 웰컴 화면 차별화 | 도메인 특화 웰컴 UI | Medium | 2시간 |
| T4 | AI 메시지 버블 추가 | 배경 + 아이콘 명확화 | Medium | 1시간 |
| T5 | 분석 근거 기본 접기 | 기본 collapsed 상태 | Medium | 1시간 |
| T6 | 스크롤 투 바텀 버튼 | 고정 ↓ 버튼 추가 | Low | 1시간 |
| T7 | 에이전트 응답 출처 표시 | 응답 메시지에 agent 배지 | Low | 1시간 |

---

## T1 — 사이드바 미니뷰 줄바꿈 수정

### 현상

대시보드에서 AI 사이드바를 닫힌 상태로 두면 우측에 미니 패널이 표시되는데,  
"무엇을 도와드릴까요?" 텍스트가 한 글자씩 세로로 줄바꿈됨. 가독성 0.

### 원인

`src/components/ai-sidebar/AISidebarV4.tsx` 의 미니 패널 너비 고정값이 너무 좁고,  
웰컴 텍스트에 `truncate` 처리가 없음.

### 수정

```tsx
// 미니 패널 웰컴 텍스트: truncate + 단일 줄 강제
<p className="truncate text-sm font-medium text-gray-700 whitespace-nowrap">
  무엇을 도와드릴까요?
</p>
```

또는 미니 패널에서 텍스트 완전 제거 후 아이콘+카운트만 표시.

### 완료 기준

- 미니 패널에서 텍스트 줄바꿈 없음
- 최소 패널 너비(120px 이하)에서도 레이아웃 유지

---

## T2 — 헤더 레이어 단순화

### 현상

현재 4단 구조:
1. 대시보드 상단 헤더 (OpenManager AI, 날짜, 사용자)
2. 페이지 제목: "AI 어시스턴트 / 질의, Reporter, Analyst 기능을 한 화면에서 실행"
3. 기능 탭 바: `[AI Chat] [장애 보고서] [이상감지/추세] ... [컨텍스트]`
4. 섹션 서브헤더: "AI Chat / AI 기반 대화형 인터페이스"

ChatGPT · Claude는 헤더 1단 + 채팅 영역. 현재 구조는 채팅 시작 전 스크롤 없이 보이는 영역의 30%를 헤더가 차지함.

### 수정 방향

**제거**: 섹션 서브헤더 (4번) — 탭이 이미 선택된 기능을 나타내므로 중복  
**통합**: 페이지 제목(2번)을 탭 바(3번) 좌측에 인라인 배치

```
Before:
  [AI 어시스턴트]                   ← 큰 제목 (라인 1)
  [질의, Reporter, Analyst ...]      ← 부제 (라인 2)
  [AI Chat] [장애 보고서] [이상감지] [컨텍스트]  ← 탭 (라인 3)
  [🤖 AI Chat  AI 기반 대화형 ...]   ← 섹션 헤더 (라인 4)

After:
  [🤖 AI 어시스턴트] | [AI Chat] [장애 보고서] [이상감지] ... [컨텍스트]  ← 1줄
```

### 파일

- `src/app/dashboard/ai-assistant/page.tsx` 또는 렌더링 컴포넌트
- `src/components/ai/AIWorkspaceFullscreenHeader.tsx`
- `src/components/ai/AIWorkspace.tsx`

### 완료 기준

- 헤더 영역이 1줄(48~56px)로 줄어듦
- 채팅 영역 가용 높이 증가
- 기능 탭 접근성 유지

---

## T3 — 웰컴 화면 차별화

### 현상

현재 웰컴 화면:
- 큰 봇 아이콘 (중앙)
- "무엇을 도와드릴까요?" (대제목)
- "서버 운영 질문을 빠르게 분석하고 조치안까지 연결합니다" (부제)
- 2×2 제안 카드 그리드

이 패턴은 ChatGPT의 웰컴 화면과 구조가 동일함. 서버 모니터링 플랫폼으로서 차별성이 없음.

### 수정 방향

**도메인 특화 웰컴 화면으로 교체**:

```
[현재 시스템 상태 요약 배너]
  "18대 중 17대 온라인 · 경고 1건 · CPU 평균 40%"

[질문 제안 — 현재 상태 기반 동적 생성]
  "⚠️ cache-redis-dc1-01 MEM 86% — 지금 분석할까요?"
  "📊 오늘 성능 추세는 어떤가요?"
  "🔍 지난 1시간 이상 징후 요약"
  "📋 장애 보고서 생성"
```

**카드 디자인**:
- 현재: 단색 아이콘 + 평이한 텍스트
- 개선: 상태 기반 색상 (경고=주황, 정상=초록, 분석=파랑) + 현재 데이터 연동

### 파일

- `src/components/ai/WelcomePromptCards.tsx` — 정적 카드 → 동적 카드로
- `src/components/ai-sidebar/EnhancedAIChat.tsx` — 웰컴 레이아웃

### 완료 기준

- 현재 서버 상태(경고 수, CPU 평균)가 웰컴 화면에 반영됨
- 카드 클릭 시 해당 분석 질의가 자동 입력됨 (기존 동작 유지)
- "무엇을 도와드릴까요?" 문구 교체

---

## T4 — AI 메시지 버블 추가

### 현상

현재 채팅 메시지:
- 사용자: 파란 rounded-2xl 버블 (양호)
- AI: 배경 없이 흰 배경에 텍스트만 (구분감 낮음)

`src/components/ai-sidebar/SidebarMessage.tsx:175`
```tsx
className={`overflow-hidden rounded-2xl p-4 shadow-xs ${
  // 사용자만 bg-blue-600, AI는 bg-white
```

### 수정

AI 메시지에 연한 배경 추가:
```tsx
// AI 메시지 컨테이너
className="rounded-2xl bg-slate-50 border border-slate-100 p-4"

// 또는 더 구분감 있게
className="rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200 p-4 shadow-xs"
```

### 완료 기준

- 사용자/AI 메시지 배경이 시각적으로 명확히 구분됨
- AI 아이콘(🤖) → 서버 모니터링 맥락에 맞는 아이콘으로 교체 검토

---

## T5 — 분석 근거 기본 접기

### 현상

모든 AI 메시지 하단에 "분석 근거" 아코디언이 기본 펼쳐진 상태로 표시됨.  
데이터: "일반 대화 응답" 같은 단순 내용도 항상 노출 → 채팅 흐름을 방해함.

`src/components/ai/AnalysisBasisBadge.tsx` 또는 `src/components/ai-sidebar/SidebarMessage.tsx`

### 수정

```tsx
// 기본값을 collapsed로 변경
const [isExpanded, setIsExpanded] = useState(false); // true → false
```

단, 분석 근거가 중요한 경우(knowledge-base, monitoring-data 출처)는 아이콘 표시로 존재 암시:
```
[📊] 분석 근거 보기 ›   ← 접힌 상태 (기본)
[📊] 분석 근거 닫기 ∨   ← 펼친 상태
```

### 완료 기준

- AI 메시지 기본 상태에서 분석 근거 숨김
- 클릭 시 펼쳐짐 (기존 기능 유지)
- 채팅 메시지 간 시각적 여백 증가

---

## T6 — 스크롤 투 바텀 버튼

### 현상

대화가 길어지면 이전 메시지를 보다가 최신 메시지로 돌아가기 위해  
수동 스크롤이 필요함. ChatGPT · Claude 모두 ↓ 고정 버튼 제공.

### 수정

`src/components/ai-sidebar/ChatMessageList.tsx`에 스크롤 위치 감지 + 버튼 추가:

```tsx
const [showScrollButton, setShowScrollButton] = useState(false);

// 스크롤 핸들러
const handleScroll = () => {
  const el = scrollContainerRef.current;
  if (!el) return;
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  setShowScrollButton(!isNearBottom);
};

// 버튼 렌더링
{showScrollButton && (
  <button
    onClick={() => scrollContainerRef.current?.scrollTo({ top: 9999, behavior: 'smooth' })}
    className="absolute bottom-4 right-4 z-10 rounded-full bg-white border border-slate-200 shadow-md p-2 hover:bg-slate-50"
  >
    <ChevronDown className="h-4 w-4 text-slate-600" />
  </button>
)}
```

### 완료 기준

- 스크롤이 최신 메시지에서 100px 이상 위로 올라가면 ↓ 버튼 표시
- 버튼 클릭 시 부드럽게 최신 메시지로 이동
- 최신 메시지가 보이면 버튼 숨김

---

## T7 — 에이전트 응답 출처 배지

### 현상

AI 응답이 어떤 에이전트(NLQ, Analyst, Reporter, Advisor)에서 왔는지 표시 없음.  
분석 근거 내에만 있어서 접힌 상태에서 사용자가 알 수 없음.

### 수정

메시지 타임스탬프 영역에 에이전트 배지 추가:

```tsx
// SidebarMessage.tsx
<span className="inline-flex items-center gap-1 text-xs text-slate-400">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
  {agentName}  {/* "Analyst", "NLQ", "Reporter" 등 */}
</span>
```

기존 `AgentHandoffBadge.tsx` 컴포넌트를 재활용 가능.

### 완료 기준

- 각 AI 메시지에 에이전트 이름이 타임스탬프 옆에 표시됨
- 데이터 없을 때(undefined)는 표시 생략

---

## 실행 순서 (Codex 담당)

```
Phase 1 — Quick Wins (당일)
  T1: 사이드바 미니뷰 줄바꿈 수정 → commit
  T5: 분석 근거 기본 접기 → commit
  T2: 헤더 레이어 단순화 → commit

Phase 2 — UX 개선 (다음 세션)
  T4: AI 메시지 버블 추가 → commit
  T6: 스크롤 투 바텀 버튼 → commit
  T7: 에이전트 배지 → commit

Phase 3 — 웰컴 화면 (별도 세션, 데이터 연동 필요)
  T3: 웰컴 화면 차별화 (동적 카드) → commit
```

각 Phase 완료 후 `npm run validate:all` 통과 확인.

---

## 완료 기준 (전체)

- [ ] T1: 미니뷰 텍스트 줄바꿈 없음
- [ ] T2: 헤더 1줄로 통합
- [ ] T3: 웰컴 화면에 현재 서버 상태 반영
- [ ] T4: 사용자/AI 버블 시각 구분 명확
- [ ] T5: 분석 근거 기본 접힘
- [ ] T6: 스크롤 복귀 버튼 동작
- [ ] T7: 에이전트 배지 표시
- [ ] `npm run validate:all` 통과
- [ ] 기존 AI 기능(스트리밍, 분석 근거, 재생성, 복사) 동작 유지

---

## 보존할 현재 강점

| 기능 | 이유 |
|------|------|
| 분석 근거 투명성 | ChatGPT/Claude 없는 차별화 기능. 접기만 개선 |
| Agent Handoff Badge | 멀티 에이전트 아키텍처 시각화 |
| 장애 보고서 / 이상감지 탭 | 도메인 특화 기능. 탭 제거보다 UX 개선 |
| 스트리밍 워밍업 인디케이터 | 로딩 UX 기존 구현 유지 |
| 리사이즈 핸들 | 사이드바 너비 조절 기능 유지 |
