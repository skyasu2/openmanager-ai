> Owner: project
> Status: In Progress
> Last reviewed: 2026-04-24

# QA Residual Risk Improvement Plan

- 상태: In Progress
- 작성일: 2026-04-24
- TODO.md 연결: Active Tasks > QA residual risk improvement
- 검토 상태: Claude Code 검토 반영 완료. 잔여 구현 Task는 failing test 우선.

## 목표

최근 Vercel frontend QA 이후 남은 잔여 리스크를 릴리즈 차단 결함과 운영성 경고로 분리하고, 실질 개선 효과가 큰 항목부터 최소 변경으로 줄인다.

핵심 목표는 세 가지다.

- AI 응답 QA에서 dashboard snapshot과 같은 데이터 슬롯을 기준으로 검증했음을 evidence에 남긴다.
- 신규 QA evidence가 저장소 용량을 계속 키우지 않도록 run 단위 size budget을 자동으로 보이게 한다.
- `gate-window-regression-open`처럼 과거 rolling warning이 현재 release blocker로 오해되지 않도록 active/historical 경고를 분리한다.

## 배경

현재 상태 기준 확인된 잔여 리스크는 아래와 같다.

- `data-metrics-quality` open gap: AI 응답 count parity는 확인하지만, dashboard snapshot의 데이터 슬롯/출처가 evidence에 구조화되어 있지 않다.
- QA evidence size warning: `reports/qa/evidence=72.80MiB / 332파일`, warning 기준 `40MiB`.
- orphan durable evidence: 6개, 약 `1.01MiB`. 삭제해도 size warning 해소 효과가 낮다.
- `gate-window-regression-open`: 과거 `QA-20260424-0340` 기반 rolling warning이며 현재 release-gate-only window는 clean이다.
- real LLM prompt 검증은 frontend UI/UX sweep에서 의도적으로 제외했다. 실 LLM 검증은 별도 targeted QA로 분리해야 한다.

## 검토 반영 결과

Claude Code 검토 결과는 대체로 수용하되, 기존 커밋의 범위를 과대 완료로 해석하지 않도록 아래처럼 정리한다.

| 검토 항목 | 결론 |
|---|---|
| 런타임 변경 없이 QA evidence metadata로 gap을 닫을 수 있는가 | 충분하다. AI 응답 자체에 slot/source 출력을 강제하지 않고 QA evidence에서 dashboard slot + parity를 함께 남기는 방식을 우선한다. |
| `31431acea`의 dashboard parity guard | count parity helper/test/E2E guard는 완료된 기반 작업으로 본다. slot/source metadata는 아직 미구현이다. |
| run-level soft budget 기본값 | 초안 기준 run당 `4MiB`, 단일 screenshot `1.5MiB`를 후보로 유지한다. 구현 중 audit 결과를 보고 조정한다. |
| trend warning 분리 | 기존 warning 필드는 유지하고 classification 필드를 추가하는 호환 방식이면 breaking change가 아니다. |
| orphan evidence 6개 | 합계 약 `1.01MiB`라 이번 범위에서는 tracking-only 유지한다. |

## 이미 완료된 기반 작업

아래 항목은 이 계획서 작성 전에 완료된 기반 작업이다. 잔여 Task의 완료로 중복 계산하지 않는다.

- `31431acea` — dashboard AI count parity helper, unit test, E2E guard 추가.
- `QA-20260424-0344` / `QA-20260424-0345` — production AI parity targeted QA 기록.
- `QA-20260424-0346` / `QA-20260424-0347` — frontend UI/UX sweep 및 core route follow-up QA 기록.

## 범위

포함한다.

- Playwright AI parity evidence에 dashboard snapshot slot/source 정보를 구조화해 남기는 테스트/헬퍼 개선.
- `qa:evidence:audit`에 최근 run 또는 run별 artifact size visibility를 추가하는 개선.
- `qa:status`/trend 출력에서 active release blocker와 historical rolling warning을 분리하는 개선.
- QA 문서에 신규 evidence capture budget 기준을 명시하는 문서 개선.
- 구현 후 필요할 경우 비용 보호를 전제로 targeted live AI QA를 1회만 추가 기록.

제외한다.

- 기존 referenced QA evidence를 대량 삭제하거나 임의 archive하지 않는다.
- orphan 6개를 이번 작업의 주목표로 삭제하지 않는다.
- warning threshold를 단순 상향해 경고를 숨기지 않는다.
- broad QA 안에 실 LLM 호출을 포함하지 않는다.
- 제품 런타임 UI/API 계약 변경은 1차 범위에서 제외한다. 단, 다른 AI 검토 후 product metadata가 필요하다고 판단되면 별도 plan으로 승격한다.

## 우선순위 판단

| 우선순위 | 항목 | 판단 |
|---|---|---|
| P1 | `data-metrics-quality` evidence provenance | QA 신뢰도 개선 효과가 크며, 기존 parity guard와 직접 연결된다. |
| P2 | 신규 evidence size budget visibility | 앞으로의 저장소 비대화를 막는 예방 효과가 크다. |
| P2 | active/historical trend warning 분리 | 사용자/AI가 release 상태를 오해하지 않게 한다. |
| P3 | orphan durable evidence 정리 | 합계 약 1.01MiB라 즉시 효과가 작다. 추적만 유지한다. |

## 계약 (Contract)

> Claude Code 검토를 반영해 계약 초안을 확정했다. 잔여 구현은 failing test 우선으로 진행한다.

### 변경 대상 파일

예상 변경 파일은 아래다. 검토 후 실제 파일은 축소할 수 있다.

- `tests/e2e/helpers/dashboard-ai-parity.ts`
- `tests/unit/playwright/dashboard-ai-parity.test.ts`
- `tests/e2e/dashboard-ai-chat.spec.ts`
- `scripts/qa/audit-qa-evidence.js`
- `scripts/qa/qa-trends.js`
- `scripts/qa/qa-status-markdown.js`
- `reports/qa/README.md`
- `reports/planning/qa-residual-risk-improvement-plan.md`
- `reports/planning/TODO.md`

### 입출력 계약

| 대상 | 입력 | 출력 | 에러/경계 케이스 |
|---|---|---|---|
| `parseDashboardStatusSnapshot()` | dashboard text | status counts + optional slot/source metadata | slot text가 없으면 counts는 유지하고 metadata는 `null` 또는 빈 값 |
| `readDashboardStatusSnapshot()` | Playwright `Page` | dashboard status snapshot evidence object | counts 파싱 실패 시 기존처럼 명시적 에러 |
| `dashboard-ai-chat.spec.ts` evidence path | dashboard snapshot + AI response text | parity assertion message 또는 durable evidence에 slot/source 포함 | 실 LLM 호출 실패 시 QA run에 실패/스킵 사유를 분리 기록 |
| `audit-qa-evidence.js` | run JSON + evidence files | recent/run-level artifact size summary + warning | missing artifact path는 기존 strict 동작 유지 |
| `buildQaTrendSnapshot()` | QA tracker runs | active release warnings와 historical rolling warnings 구분 | 기존 trend warning 코드 호환 유지 |
| `QA_STATUS.md` rendering | trend snapshot | Active Gate Warnings / Historical Trend Warnings 분리 출력 | historical warning은 release blocker로 표시하지 않음 |

### 테스트 시나리오 (구현 전 확정)

- [ ] 시나리오 1: dashboard text에 `Synthetic OTel snapshot · 16:00 KST`가 있으면 snapshot metadata에 `16:00 KST`가 보존된다.
- [ ] 시나리오 2: dashboard text에 slot/source 문구가 없어도 기존 count parity 테스트는 깨지지 않는다.
- [ ] 시나리오 3: AI parity E2E 실패 메시지 또는 evidence에는 dashboard counts와 slot/source가 함께 남는다.
- [ ] 시나리오 4: QA audit는 최근 run별 artifact size를 출력하고, 단일 run budget 초과 시 soft warning을 표시한다.
- [ ] 시나리오 5: QA audit strict mode의 기존 missing/orphan/archive candidate 판정은 변경되지 않는다.
- [ ] 시나리오 6: trend snapshot에서 현재 release-gate-only window가 clean이면 historical rolling warning은 active blocker로 분류되지 않는다.
- [ ] 시나리오 7: `qa:status` 출력은 historical warning을 별도 섹션으로 보여준다.

## Task 목록

잔여 구현은 테스트 시나리오 기반 failing test를 먼저 추가한다.

- [x] Task 0 — 다른 AI 검토 반영: Claude Code 검토 결과를 범위/계약/제외 항목에 반영.
- [ ] Task 1 — 잔여 failing test 커밋: dashboard slot metadata, audit size summary, trend warning classification 테스트를 먼저 추가.
- [ ] Task 2 — data provenance 보완: AI parity helper와 E2E evidence에 dashboard snapshot slot/source를 포함. 기존 count parity는 `31431acea`에서 완료.
- [ ] Task 3 — evidence budget visibility 구현: `qa:evidence:audit`에 run-level 또는 recent-run artifact size summary와 soft warning 추가.
- [ ] Task 4 — trend warning 분리 구현: active release blocker와 historical rolling warning 출력 구조 분리.
- [ ] Task 5 — 문서 갱신: `reports/qa/README.md`에 신규 evidence capture budget과 full-page screenshot 제한 기준 추가.
- [x] Task 6 — targeted QA 기반 확인: `QA-20260424-0344` / `QA-20260424-0345` production AI parity QA 기록 확인. 잔여 구현 후 필요 시 추가 targeted QA 1회만 수행.
- [ ] Task 7 — 최종 리뷰/커밋/푸시: 검증 결과와 잔여 리스크를 plan/TODO에 반영.

## 완료 기준

- [ ] `data-metrics-quality` open gap이 새 QA run에서 completed 또는 non-blocking tracked 상태로 명확히 정리된다.
- [ ] `npm run qa:evidence:audit`가 최근 run evidence size를 사람이 판단 가능한 형태로 출력한다.
- [ ] `npm run qa:status`에서 historical rolling warning과 active release blocker가 구분된다.
- [ ] 신규 evidence 생성 정책이 `reports/qa/README.md`에 반영된다.
- [ ] targeted live AI QA는 broad QA와 분리되어 기록된다.
- [ ] 기존 QA tracker/evidence audit의 missing durable artifact path는 `0`을 유지한다.
- [ ] `npm run type-check`, `npm run lint`, 관련 unit test, `npm run qa:evidence:audit`, `npm run qa:status`가 통과한다.

## 검증 명령 후보

구현 후 최소 검증 후보는 아래다.

```bash
npx vitest run tests/unit/playwright/dashboard-ai-parity.test.ts
npm run qa:evidence:audit
npm run qa:status
npm run docs:lint:changed
npm run type-check
npm run lint
```

실 LLM targeted QA는 비용 보호 후 별도로 1회만 실행한다.

```bash
npm run check:usage:vercel
PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts
```

## 다른 AI 검토 결론

- 제품 런타임 변경 없이 QA evidence metadata 중심으로 `data-metrics-quality` gap을 닫는 접근은 충분하다.
- AI 응답 자체가 slot/source를 말하도록 강제하지 않는다. QA evidence가 dashboard slot과 응답 parity를 함께 남기면 된다.
- run-level soft budget 기본 후보는 run당 `4MiB`, 단일 screenshot `1.5MiB`로 둔다.
- `gate-window-regression-open` 분리는 기존 warning 필드를 유지하고 분류 필드를 추가하는 방식이면 breaking change가 아니다.
- orphan evidence 6개는 이번 범위에서 제외하고 tracking-only로 유지한다.

## 리스크 및 제어

- Free Tier: 실 LLM 검증은 targeted 1회로 제한하고, 실행 전 `npm run check:usage:vercel`을 수행한다.
- 증거 보존: referenced evidence는 자동 삭제하지 않는다.
- 호환성: trend JSON 필드는 기존 소비자가 깨지지 않도록 기존 warning 필드를 유지하고 분류 필드만 추가하는 방향을 우선한다.
- 과도 개선 방지: threshold 상향이나 대량 archive로 숫자만 숨기는 변경은 금지한다.
