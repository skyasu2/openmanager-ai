> Owner: project
> Status: Approved
> Last reviewed: 2026-04-29

# AI Assistant UX Polish Plan

## 1. 배경

`v8.11.53` Vercel production을 Playwright MCP로 측정한 UX 분석 결과, 기능 완성도는 높으나 visual polish 측면에서 정돈이 필요한 항목이 확인됨. 본 계획서는 그 중 ROI가 높은 P1·P2만 대상으로 한다.

분석 증거: `.playwright-mcp/ux-sidebar-default.png`, `.playwright-mcp/ux-fullscreen-default.png`, `.playwright-mcp/ux-fullscreen-mobile.png`

## 2. 범위

- 포함:
  - **P1-A**: 타이포 스케일 9단계 → 4단계 정리 (`text-xs 12 / sm 14 / base 16 / lg 18`)
  - **P1-B**: 터치 타겟 ≥24px (모바일은 ≥44px) 강제. 현재 22~36px 13개 식별
  - **P1-C**: 사이드바(light) ↔ 전체페이지(dark) 톤 통일. 두 모드 모두 light로 정렬
  - **P2-A**: 우측 System Context 패널의 "AI Engine: Error" + "AI 엔진 상태: 확인 안 됨" 중복 통합 (1개로)
  - **P2-B**: Provider Routing 활성 provider 강조 (현재 "Configured" 4개 모두 회색)
- 제외:
  - 모바일 좌·우 패널 drawer/bottom-sheet 신규 도입 (P4 — 별도 계획)
  - Streaming token 단위 점진 렌더 도입 (AI SDK UI message protocol 마이그레이션 — 별도 계획)
  - dark/light theme toggle 도입 (사용자 요구 없음, YAGNI)

## 3. 공식 제약 기준

- **WCAG 2.5.5 Target Size**: AAA 44×44px, AA 24×24px (터치 타겟 기준)
  - https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- **Tailwind 토큰만 사용** (`.claude/rules/code-style.md` Arbitrary Values 금지)
- **공유 파일 편집 제한** (`.claude/rules/ai-tools.md`): `components/ui/`, `types/`, `stores/`, `lib/utils.ts`는 lead가 직접 수정. 본 계획은 `components/ai/`, `components/ai-sidebar/` 한정

## 4. 계약

| 대상 | 계약 |
|------|------|
| 타이포 스케일 | `components/ai/`, `components/ai-sidebar/` 하위 모든 텍스트는 `text-xs`(12) / `text-sm`(14) / `text-base`(16) / `text-lg`(18) 4종만 사용. `text-[10px]`, `text-[11px]` arbitrary 금지 |
| 터치 타겟 | 같은 영역 모든 `<button>`은 `min-w-6 min-h-6`(24px, desktop), 모바일은 `min-w-11 min-h-11`(44px). invisible-extension은 `::before` pseudo로만 |
| 모드 톤 통일 | `/dashboard/ai-assistant`의 body bg를 `bg-background`(light) 토큰으로 전환. dark `#1d283a` 하드코딩 제거 |
| System Context 중복 | 우측 패널 `AI Engine` 행과 `AI 엔진 상태` 카드를 단일 `AIEngineHealthBadge`로 합치고, fallback "확인 안 됨"은 동일 컴포넌트의 한 상태로 흡수 |
| Provider Routing 강조 | 응답 metadata `finalProvider`를 SystemContextPanel에 전달, 활성 provider만 `bg-primary text-primary-foreground` fill, 나머지는 outline |

## 5. 테스트 시나리오

- [ ] `components/ai/**` `components/ai-sidebar/**`에 `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]` arbitrary class가 0건임을 grep으로 검증
- [ ] Storybook에서 사이드바/전체페이지 각 모드 캡처가 light bg(`#ffffff` 계열)로 일치
- [ ] Playwright DOM 측정으로 모든 `<button>`이 desktop 24px / mobile(390×844) 44px 이상
- [ ] SystemContextPanel 단위 테스트: AI Engine 상태가 `ok | error | unknown` 3-상태 머신으로 단일 노출
- [ ] Provider Routing 컴포넌트 단위 테스트: `finalProvider="groq"`일 때 Groq 칩만 fill 적용
- [ ] Vercel production smoke (`scope=targeted`, `releaseFacing=true`) — 동일 query로 회귀 없음 확인 후 `npm run qa:record`

## 6. Task 목록

- [x] Task 0 — failing test 커밋 (typography arbitrary lint, target-size assertion, SystemContextPanel state machine spec, Provider chip fill spec)
- [ ] Task 1 — 타이포 스케일 정리 (P1-A)
- [ ] Task 2 — 터치 타겟 ≥24/44 강제 (P1-B)
- [ ] Task 3 — 전체페이지 light 톤 통일 (P1-C)
- [ ] Task 4 — System Context AI Engine 상태 통합 (P2-A)
- [ ] Task 5 — Provider Routing 활성 강조 (P2-B)
- [ ] Task 6 — Playwright targeted QA + qa:record
- [ ] Task 7 — commit / push gitlab / GitHub sync

## 7. 완료 기준

- [ ] `npm run lint` 통과
- [ ] `npm run type-check` 통과
- [ ] 추가 단위/시나리오 테스트 모두 통과
- [ ] Vercel production targeted QA `releaseDecision=go`
- [ ] 증거 스크린샷 갱신: `.playwright-mcp/ux-sidebar-after.png`, `.playwright-mcp/ux-fullscreen-after.png`, `.playwright-mcp/ux-fullscreen-mobile-after.png`

## 8. 위험과 대응

| 위험 | 대응 |
|------|------|
| 타이포 일괄 변환 시 layout shift | Task 1을 컴포넌트 단위로 쪼개고 Storybook visual diff 우선 확인 |
| 터치 타겟 확장으로 사이드바 버튼이 서로 겹침 | invisible-extension(`::before`)로 시각 크기 유지, 클릭 영역만 확장 |
| dark→light 전환으로 우측 SystemContext 가독성 저하 | 카드 border + `bg-muted/30` 톤으로 분리감 확보 |
| `finalProvider` 메타가 항상 오는 건 아님 | undefined일 때는 기존 회색 outline 유지하고 "활성 미상" 툴팁 노출 |

## 9. 참조

- 분석 출처: 2026-04-28 Playwright MCP 측정 (대화 내 보고)
- WCAG 2.5.5: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- 코드 규칙: `.claude/rules/code-style.md`, `.claude/rules/architecture.md`
