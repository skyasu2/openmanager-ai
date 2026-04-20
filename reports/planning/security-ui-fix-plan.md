> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-04-19
> Tags: security,ui,ux,modal,bugfix

# 보안·모달·UI UX 개선 계획서

## 목표

Playwright QA 및 코드 분석으로 발견된 보안 취약점, 모달 버그, UI/UX 복잡도 문제를 우선순위별로 수정한다.  
무료 티어 비용 영향 없음 — 코드 변경만.

## 현황 요약

| 구분 | 건수 | 출처 |
|------|:----:|------|
| 보안 (P1) | 2건 | 코드 분석 |
| 보안 (P2) | 2건 | 코드 분석 |
| 모달 버그 | 2건 | Playwright QA 직접 관찰 |
| UI/UX 개선 | 4건 | Playwright QA 직접 관찰 |

---

## Phase 1 — 보안 P1 (난이도: ★☆☆)

### 1-1: `/api/system` GET 인증 미적용

- [ ] `src/app/api/system/route.ts:121` GET 핸들러에 `withAuth` 미들웨어 추가
- [ ] 기존 POST 핸들러와 동일한 인증 패턴 적용
- [ ] 테스트: 미인증 GET 요청 → 401 반환 확인

### 1-2: Rate Limiting 미적용 공개 엔드포인트

- [ ] `src/app/api/web-vitals/route.ts` POST — rate limiter 적용 (10req/min per IP)
- [ ] `src/app/api/security/csp-report/route.ts` POST — rate limiter 적용 (20req/min per IP)
- [ ] `src/app/api/csrf-token/route.ts` GET — rate limiter 적용 (30req/min per IP)
- [ ] 기존 `src/lib/rate-limit.ts` (또는 동등 유틸) 재사용 — 새 의존성 추가 금지
- [ ] 테스트: 초과 요청 시 429 반환 확인

---

## Phase 2 — 모달 버그 수정 (난이도: ★★☆)

### 2-1: 서버 상세 모달 "로그 & 네트워크" 탭 — No logs available 버그

**재현**: 서버 카드 클릭 → "로그 & 네트워크" 탭 → "No OTel structured logs found for this server in the current time slot"

**원인 추정**: 현재 시간 슬롯 기준으로 hourly JSON을 조회할 때 서버 ID 매핑 또는 슬롯 계산이 잘못됨

- [ ] 로그 조회 로직 확인: 어느 hour JSON에서 어떤 서버 ID로 logs[] 추출하는지 추적
- [ ] `public/data/otel-data/hourly/hour-XX.json` logs 배열 구조와 서버 ID 매핑 검증
- [ ] 버그 수정: 현재 슬롯 기준 logs[] 정상 표시
- [ ] 빈 로그인 경우 "이 시간대에 기록된 로그가 없습니다" 한국어 메시지로 변경

### 2-2: "연결 정보" 상태 불일치 — "불안정" vs 네트워크 상태 "양호"

**재현**: 로그 & 네트워크 탭 → 하단 "연결 정보" 섹션이 "불안정" / 상단 "네트워크 상태" 섹션이 "양호"

- [ ] 두 섹션이 참조하는 데이터 소스 동일화 또는 로직 통일
- [ ] "연결 정보" 상태값 계산 기준을 네트워크 사용률과 일치시킴

---

## Phase 3 — UI/UX 개선 (난이도: ★☆☆)

### 3-1: Active Alerts 모달 한국어 통일

**재현**: 알림(1) 버튼 클릭 → 모달 제목 "Active Alerts", 닫기 "Close", 배지 "WARNING", 경과 "elapsed" 영어 표시

- [ ] 모달 제목: `"Active Alerts"` → `"활성 알림"`
- [ ] 닫기 버튼: `"Close"` → `"닫기"`
- [ ] 심각도 배지: `"WARNING"` → `"경고"`, `"CRITICAL"` → `"위험"`
- [ ] 경과 시간: `"20m elapsed"` → `"20분 경과"`

### 3-2: 성능 분석 탭 "일시정지" 버튼 스타일 격 낮추기

**재현**: 서버 상세 모달 → 성능 분석 탭 → 빨간색 primary 스타일 "일시정지" 버튼이 메인 차트보다 시선 집중

- [ ] 버튼 variant: `destructive` / `primary` → `outline` 또는 `ghost`
- [ ] 일시정지 상태일 때만 강조색(amber) 표시, 기본은 neutral

### 3-3: 대시보드 상태 헤더 버튼 그룹 UX 개선

**재현**: 상태 헤더에 "알림(1) + 이력 + 로그" 3개 버튼이 독립적으로 나열 → 과도한 클릭 타깃

- [ ] 3개 버튼을 하나의 `ButtonGroup` 컴포넌트로 묶기 (시각적 구분선만 적용)
- [ ] 레이블 없이 아이콘+카운트만으로 충분한 경우 label 숨김 처리(모바일 고려)

### 3-4: 서버 카드 IP 주소 표시 위치 이동

**재현**: 서버 카드 하단에 `10.100.x.x` 내부 IP 직접 노출 → 카드가 복잡해 보임

- [ ] 카드 본문: IP 제거, AZ/위치 정보만 유지
- [ ] 서버 상세 모달 "종합 상황" → 시스템 정보 섹션에만 IP 표시 (현재도 있음)

---

## 비범위

- 외부 SIEM/WAF 연동
- HTTPS 강제 설정 (Vercel에서 자동 처리)
- 인증 체계 전면 개편 (별도 계획)
- 모바일 반응형 전면 수정

---

## 계약 (Contract)

### 테스트 시나리오

1. **S1-auth**: 미인증 상태에서 `GET /api/system` → 응답 status `401`
2. **S2-rate-limit**: `POST /api/web-vitals` 11회 연속 → 11번째 응답 status `429`
3. **S3-logs**: 서버 상세 모달 "로그 & 네트워크" 탭에서 logs[] 있는 서버 기준 최소 1개 로그 항목 표시
4. **S4-i18n**: Active Alerts 모달에 영어 텍스트 "Active Alerts", "Close", "elapsed" 미노출
5. **S5-network-consistency**: "연결 정보" 상태와 "네트워크 상태" 섹션이 동일 데이터 소스 참조

### 비용 영향

| 항목 | 변화 |
|------|------|
| Vercel/Cloud Run 런타임 | 없음 |
| Supabase | 없음 |
| LLM 토큰 | 없음 |

---

## 검증 명령어

```bash
# 타입 검사
npm run type-check

# 빠른 테스트
npm run test:quick

# 계약 테스트 (API 인증/rate limit)
npm run test:contract

# Playwright production QA (수정 배포 후)
# → /skill qa-ops 실행
```

---

## 착수 게이트

1. Status: `Approved` ✅
2. `test(spec): security-ui-fix add failing tests before implementation` 먼저 커밋
3. 구현 커밋: `fix: security-ui-fix implement auth/rate-limit/modal-bugs/ux`
