> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-29
> Tags: dashboard,modal,qa,otel,frontend

# Dashboard Modal/Search Hardening Plan

- 상태: Completed
- 작성일: 2026-04-29
- TODO.md 연결: Recent Completed > Dashboard modal/search display hardening

## 목표

화이트 모드 대시보드 안에서 열리는 모달의 테마 불일치, 로그/지표/알림 검색 UI의 잘림 가능성, Vercel public OTel 정적 데이터와 KST 24시간 회전 슬롯 표기의 혼선을 정리한다.

## 범위

- 포함:
  - 대시보드 모달 테마 정렬: `TopologyModal`, `AILoginRequiredModal`, `LogExplorerModal`, `EnhancedServerModal` 로그 패널 경계.
  - 검색/필터 표시 안정화: 로그 탐색기, 알림 이력, 서버 상세 메트릭 분석 컨트롤.
  - 긴 텍스트/좁은 화면 대응: 알림 행, 로그 행, 필터 바, 통계 footer.
  - OTel 정적 데이터 표기 정리: Vercel public static asset, KST 10분 슬롯, 24시간 회전 모델.
  - 프로덕션/로컬 QA: visibility assertion에 더해 clipping geometry 검사 추가.
- 제외:
  - 랜딩페이지 수정 전체.
  - DB/Supabase schema 변경.
  - OTel 데이터 생성기나 synthetic dataset 자체 변경.
  - Cloud Run AI Engine 로직 변경.
  - Vercel/Cloud Run 리소스 스펙 상향.

## 절대 제약

- 랜딩페이지는 수정하지 않는다.
- 아래 경로는 이 작업의 변경 대상에서 제외한다.
  - `src/app/page.tsx`
  - `src/app/main/**`
  - `src/components/landing/**`
  - `docs/status.md`의 랜딩 관련 설명
  - 랜딩 전용 E2E/QA 증거
- 작업 종료 전 `git diff --name-only`로 위 경로가 변경되지 않았음을 확인한다.
- 로그/메트릭 데이터는 DB 실시간 조회로 바꾸지 않는다. 현재 기준은 `public/data/otel-data` 정적 OTel 데이터 + KST 10분 슬롯 회전이다.

## 현재 분석 요약

| 영역 | 현재 상태 | 개선 판단 |
|------|-----------|-----------|
| `TopologyModal` | 전체 다크 테마 | 화이트 대시보드와 불일치. 프레임은 light, 그래프 캔버스는 필요 시 dark 유지 |
| `AILoginRequiredModal` | 전체 다크 테마 | 대시보드 헤더에서 열리므로 light dialog로 정렬 |
| `LogExplorerModal` | light shell + dark terminal | 의도된 terminal panel로 유지. 경계/scroll/empty/error 상태 보강 |
| `EnhancedServerModal` | light shell | 로그 terminal panel만 dark. 내부 scroll/height 안정성 유지 |
| `AlertHistoryModal` | light shell | 긴 metric/threshold 텍스트에서 wrap 보강 필요 |
| Vercel OTel static | `/data/otel-data/*` 200, cache HIT | 연결 정상. UI/metadata 명칭 통일 필요 |

## 계약 (Contract)

### 변경 대상 파일

- `src/components/dashboard/TopologyModal.tsx`
- `src/components/dashboard/AILoginRequiredModal.tsx`
- `src/components/dashboard/log-explorer/LogExplorerModal.tsx`
- `src/components/dashboard/alert-history/AlertHistoryModal.tsx`
- `src/components/dashboard/EnhancedServerModal.tsx`
- `src/components/dashboard/EnhancedServerModal.LogsTab.parts.tsx`
- `src/components/dashboard/EnhancedServerModal.MetricsTab.tsx`
- `src/components/dashboard/DashboardSummary.tsx`
- `tests/e2e/dashboard-alerts-logs.spec.ts`
- `tests/e2e/dashboard-modal-layout.spec.ts` 또는 기존 dashboard E2E helper
- 필요 시 API metadata label만:
  - `src/app/api/monitoring/report/route.ts`
  - `src/app/api/servers/[id]/route.ts`
  - `src/app/api/servers-unified/route.ts`

### 변경 금지 파일

- `src/app/page.tsx`
- `src/app/main/**`
- `src/components/landing/**`
- landing route 전용 테스트/문서/증거

### UI 계약

| 화면 | 입력/트리거 | 기대 출력 | 에러/빈 상태 |
|------|-------------|-----------|--------------|
| Active Alerts | `활성 알림 보기` 클릭 | light dialog, header/body/footer 모두 viewport 안에 표시 | 알림 없음 문구 표시 |
| Alert History | 검색어, severity/state/time/server 필터 | light dialog, 필터 바 wrap, 행 텍스트 wrap/truncate 균형 | 알림 없음/로드 실패 문구 표시 |
| Log Explorer | keyword/level/source/server 필터 | light dialog + dark terminal panel, 로그 행 내부 scroll | 로그 없음/로드 실패/재시도 표시 |
| Topology | `토폴로지 맵` 클릭 | light modal frame, graph canvas 표시, close 버튼 접근 가능 | 로딩 fallback 표시 |
| Server Metrics | 서버 상세 > 성능 분석 > 분석 | metric/time/prediction/anomaly controls 표시, chart 영역 비어 있지 않음 | 데이터 없음/오류 표시 |
| Server Logs | 서버 상세 > 로그 & 네트워크 | light section + dark terminal, syslog/alerts/streams 전환 가능 | 로그 없음/stream 없음 표시 |

### 데이터 계약

| 데이터 경로 | 기준 | 변경 허용 |
|-------------|------|-----------|
| `/data/otel-data/resource-catalog.json` | Vercel public static asset, 200 expected | 불가 |
| `/data/otel-data/timeseries.json` | Vercel public static asset, 200 expected | 불가 |
| `/data/otel-data/hourly/hour-XX.json` | KST 현재 hour 기반 24시간 회전 | 불가 |
| `/api/health?service=parity` | `Math.floor(KST_minutes_of_day / 10)` | 불가 |
| API `metadata.dataSource` | 사용자 혼선 없는 명칭 | string label만 변경 가능 |

### 테스트 시나리오 (구현 전 확정)

- [x] 시나리오 1: dashboard modal trigger buttons are visible — 기대 결과: `활성 알림 보기`, `알림 이력 보기`, `로그 검색 보기`, `토폴로지 맵` 트리거가 데스크톱/모바일에서 잘리지 않는다.
- [x] 시나리오 2: dark-modal cleanup — 기대 결과: `TopologyModal`, `AILoginRequiredModal` shell computed background가 light 계열이고, terminal/canvas 영역만 dark 예외로 남는다.
- [x] 시나리오 3: log explorer filtering — 기대 결과: keyword, level, source, server 필터가 표시되고 필터 변경 후 modal이 유지된다.
- [x] 시나리오 4: alert history wrapping — 기대 결과: 긴 서버명/메트릭/threshold 조합에서도 행 내용이 viewport 밖으로 나가지 않는다.
- [x] 시나리오 5: metrics advanced controls — 기대 결과: metric buttons, time select, prediction/anomaly checkboxes, refresh button, chart container가 표시된다.
- [x] 시나리오 6: static OTel public data — 기대 결과: catalog/timeseries/current hour JSON이 200이고 parity hour/slot 계산과 일치한다.
- [x] 시나리오 7: landing guard — 기대 결과: 최종 diff에 landing 금지 경로가 없다.

## Task 목록

> 로컬 구현/QA 완료. 커밋/배포는 사용자 별도 요청 전까지 보류한다.

- [x] Task 0 — failing test 추가
  - 완료 기준: 모달 테마, clipping geometry, filter visibility, static OTel parity 테스트가 실패 상태로 추가된다.
- [x] Task 1 — 모달 테마 정렬
  - 완료 기준: `TopologyModal`, `AILoginRequiredModal` shell이 light mode로 전환되고 terminal/canvas dark 예외가 명확히 분리된다.
- [x] Task 2 — 검색/필터 표시 안정화
  - 완료 기준: 로그 탐색기와 알림 이력의 필터 바, reset/summary, empty/error/loading 상태가 작은 viewport에서도 잘리지 않는다.
- [x] Task 3 — 서버 상세 메트릭/로그 패널 안정화
  - 완료 기준: 성능 분석 컨트롤과 로그 terminal panel이 내부 scroll 기준으로 표시되고 layout shift가 없다.
- [x] Task 4 — OTel 데이터 소스 표기 정리
  - 완료 기준: UI/API metadata 문구가 Vercel public static OTel + KST 24h rotating slot 모델을 같은 용어로 설명한다.
- [x] Task 5 — QA 기록
  - 완료 기준: deterministic test, targeted Playwright, static asset/parity smoke 결과를 QA tracker에 기록한다.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `fix:` | ✅ | ❌ | ✅ |
| Task 2 | `fix:` | ✅ | ❌ | ✅ |
| Task 3 | `fix:` | ✅ | ❌ | ✅ |
| Task 4 | `chore:` 또는 `fix:` | ✅ | ❌ | metadata만이면 ✅ |
| Task 5 | `test:` 또는 `docs:` | ✅ | ❌ | 필요 시 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing tests가 실제 모달/검색/데이터 계약을 과도하지 않게 표현하는지 |
| Task 1~3 완료 후 | light mode 일관성, mobile overflow, accessibility, focus/ESC close 유지 |
| Task 4 완료 후 | DB 실시간 조회로 오해되지 않는지, Vercel static/KST rotating slot 용어가 정확한지 |
| 전체 완료 후 | landing 금지 경로 미변경, QA evidence 기록, 비용 영향 없음 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| browser geometry test가 환경 제약으로 실행 불가 | 기존 visibility E2E + static CSS/DOM assertion으로 대체하고 QA에 제약 기록 |
| Topology canvas가 light shell에서 가독성 저하 | canvas만 dark 유지, shell/header/footer만 light로 제한 |
| API metadata label 변경이 하위 테스트를 깨뜨림 | shape 변경 없이 label compatibility 또는 test expectation 정렬 |
| 범위가 랜딩으로 번짐 | 즉시 중단하고 해당 변경 제외. landing 작업은 별도 사용자 승인 없이는 금지 |

## 완료 기준

- [x] `git diff --name-only`에 landing 금지 경로가 없다.
- [x] `npx vitest run` targeted dashboard component tests 통과.
- [x] `PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-alerts-logs.spec.ts --config playwright.config.ts` 로컬 QA 통과.
- [x] 추가 modal layout/clipping component assertion 통과.
- [x] `/data/otel-data/resource-catalog.json`, `/data/otel-data/timeseries.json`, 현재 hour JSON, `/api/health?service=parity` smoke 통과.
- [x] `npm run type-check` 통과.
- [x] `npm run lint` 또는 `npm run lint:changed` 통과.
- [x] `npm run qa:record -- --input <json>`, `npm run qa:status`, `npm run qa:evidence:audit` 완료.
- [x] TODO.md에 완료 요약 추가.

## 완료 기록

- 완료일: 2026-04-29
- QA run: `QA-20260429-0362`
- 로컬 E2E: `tests/e2e/dashboard-alerts-logs.spec.ts` 6/6 통과
- 단위 회귀: dashboard modal/search targeted Vitest 31/31 통과
- 정적 검증: `npm run type-check`, `npm run lint`, `npm run test:quick` 통과
- Vercel static smoke: `resource-catalog.json`, `timeseries.json`, `hourly/hour-03.json` HTTP 200/HIT, parity `hour=3`, `globalSlotIndex=18`
- 배포 상태: 미배포. 사용자 요청 전까지 GitLab/Vercel 배포는 수행하지 않음.
