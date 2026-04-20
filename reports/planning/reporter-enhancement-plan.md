> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-04-19
> Tags: reporter,ui,graphrag,otel,postmortem

# Reporter 고도화 계획서

## 목표

Reporter Agent의 3가지 핵심 미비점을 무료 티어 내에서 보완하여 PagerDuty 기본 인시던트 플로우(생성→타임라인→종결)를 커버한다.

## 현황

| 항목 | 현재 | 개선 목표 |
|------|------|----------|
| 로그 표시 | 요약 텍스트만 | 타임스탬프별 로그 타임라인 UI |
| 연관 서버 | 없음 | 동일 시간대 이상 서버 자동 교차조회 |
| 보고서 구조 | 요약 + 심각도만 | Postmortem 섹션(타임라인 + 원인가설 + 재발방지) 포함 |

## 실행 범위

### Phase 1 — 로그 타임라인 UI (난이도: ★☆☆)

기존 `public/data/otel-data/hourly/hour-XX.json` 로그를 Reporter 안에서 시각화한다. 추가 API 없음.

- [ ] 1-1: Reporter 컴포넌트에 `LogTimeline` 서브 섹션 추가
  - 해당 인시던트 시간대 hour JSON에서 `logs[]` 추출
  - 타임스탬프 오름차순 정렬, severity(ERROR/WARN/INFO) 색상 구분
  - 서버 이름 기준 필터 드롭다운
- [ ] 1-2: 로그 항목 클릭 시 상세 메시지 expand (accordion)
- [ ] 1-3: 타임라인 기본 접힘(collapsed), "로그 타임라인 보기" 토글로 UX 노이즈 최소화

### Phase 2 — 연관 서버 자동 링크 (난이도: ★★☆)

GraphRAG의 `knowledge_relationships` traversal을 재활용해 동일 시간대 이상 서버를 자동으로 찾는다.

- [ ] 2-1: Reporter Agent 프롬프트에 "동일 시간대 타 서버 이상 여부 교차조회" 지시 추가
  - 기존 `/api/ai/supervisor` 경로 활용 (추가 엔드포인트 불필요)
  - 결과: `affectedServers: [{ name, severity, metric, value }]`
- [ ] 2-2: 보고서 UI에 "연관 서버" 섹션 추가
  - 서버명 + 심각도 배지 + 주요 메트릭 요약 1줄
  - 없으면 "연관 서버 없음" 표시 (빈 섹션 제거)
- [ ] 2-3: 연관 서버 클릭 → 해당 서버 대시보드 패널 포커스 (라우팅 또는 상태 업데이트)

### Phase 3 — Postmortem MD 섹션 자동화 (난이도: ★☆☆)

Reporter Agent 출력 구조를 확장해 MD 복사/다운로드 시 Postmortem 섹션이 포함되도록 한다.

- [ ] 3-1: Reporter Agent 프롬프트에 Postmortem 섹션 생성 지시 추가
  ```
  ## Postmortem
  ### 타임라인
  - HH:MM — 최초 이상 감지 (서버명, 메트릭값)
  - HH:MM — 경고 임계값 초과
  - HH:MM — 피크 / 최악 상태
  ### 원인 가설
  1. (주원인)
  2. (보조 원인)
  ### 재발 방지
  - [ ] (액션 아이템 1)
  - [ ] (액션 아이템 2)
  ```
- [ ] 3-2: UI에 Postmortem 탭 또는 섹션 추가 (기존 요약과 분리)
- [ ] 3-3: MD 다운로드 파일명에 날짜 포함 (`incident-YYYYMMDD-HHMMSS.md`)

## 비범위

- Slack Webhook 연동
- GitHub Issues / Jira 티켓 생성
- 이메일 발송
- Supabase incidents 테이블 (별도 계획 시 추가)
- 실시간 스트리밍 로그

## 계약 (Contract)

### 테스트 시나리오

1. **T1-timeline-render**: 보고서 생성 후 "로그 타임라인 보기" 토글 클릭 시 최소 1개 이상 로그 항목 표시
2. **T2-severity-color**: ERROR 로그는 red, WARN은 yellow, INFO는 gray 배지로 구분 표시
3. **T3-affected-servers**: Reporter 응답 JSON에 `affectedServers` 배열 존재 (empty array 허용)
4. **T4-postmortem-md**: MD 다운로드 파일에 `## Postmortem` 헤더와 `### 타임라인`, `### 원인 가설`, `### 재발 방지` 서브섹션 포함
5. **T5-filename-date**: 다운로드 파일명이 `incident-YYYYMMDD-HHMMSS.md` 패턴

### 비용 영향

| 항목 | 변화 |
|------|------|
| Vercel/Cloud Run 런타임 | 없음 (기존 엔드포인트 재활용) |
| Supabase | 없음 (DB 변경 없음) |
| LLM 토큰 | Phase 2·3에서 Reporter 프롬프트 약 +300 token/요청 |

---

## 검증 명령어

```bash
# 타입 검사
npm run type-check

# 빠른 테스트
npm run test:quick

# Reporter 관련 컴포넌트 테스트 (구현 후)
npx vitest run tests/unit/reporter

# Playwright MCP QA (Vercel production)
# → /skill qa-ops 실행
```

---

## 착수 게이트

1. Status: `Approved` ✅
2. `test(spec): reporter-enhancement add failing tests before implementation` 먼저 커밋
3. 구현 커밋: `feat: reporter-enhancement implement log timeline / affected-servers / postmortem`
