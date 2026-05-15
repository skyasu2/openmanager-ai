> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-15
> Tags: dashboard, ux, server-card, progressive-disclosure

# 서버 카드 Peek UX 개선 계획

## 목표

서버 카드 그리드에서 **초기 로드 시 1행 + 반행(peek)** 만 보이고,
마지막 반행이 그라데이션으로 페이드아웃되어 "더 있음"을 자연스럽게 암시하도록 개선한다.
"더 보기" 버튼 클릭 시 다음 행들이 추가 렌더링된다.

## 현재 상태 확인

| 항목 | 현재 값 |
|------|---------|
| 메인 대시보드 (`DashboardContent`) | `initialVisibleRows={2}` + `surface="overview"` |
| 서버 목록 페이지 (`DashboardRoutedContent`) | `initialVisibleRows={3}` + `surface="server-list"` |
| 카드 높이 (compact variant) | `min-h-[150px]` |
| 열 수 (1280px 기준, list 모드) | 4열 |
| 초기 표시 | 2행 × 4열 = 최대 8카드 **완전히** 표시 |
| peek 구현 여부 | **없음** — 현재는 완전한 행 단위 표시 |

## 개선 방향

```
Before:
┌────┐ ┌────┐ ┌────┐ ┌────┐   ← row 1 (완전 표시)
└────┘ └────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐ ┌────┐   ← row 2 (완전 표시)
└────┘ └────┘ └────┘ └────┘
[ 더 보기 버튼 ]

After:
┌────┐ ┌────┐ ┌────┐ ┌────┐   ← row 1 (완전 표시)
└────┘ └────┘ └────┘ └────┘
┌────┐ ┌────┐ ┌────┐ ┌────┐   ← row 2 절반만 보임 (peek)
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ (그라데이션 페이드)
[ 더 보기 버튼 ]
```

### 구현 메커니즘

1. **서버 카드 그리드 컨테이너에 `max-height` 적용**
   - `peekHeight = (cardHeight × 1행 + gap) + cardHeight × 0.5`
   - compact 카드: `min-h-[150px]` → 1.5행 ≈ `~237px` (gap 12px 포함)
   - CSS 변수 또는 인라인 style로 설정

2. **페이드 오버레이 (그라데이션)**
   - 컨테이너 하단에 `absolute` position `div`
   - `bg-gradient-to-t from-white to-transparent` (배경색에 맞게)
   - 더 보기 상태에서는 숨김

3. **"더 보기" 클릭 시**
   - `max-height` 제거 또는 충분히 큰 값으로 확장
   - 페이드 오버레이 숨김
   - 기존 `handleShowMoreServers` 로직은 유지 (페이지네이션/rows 증가)

4. **"접기" 클릭 시**
   - `max-height`를 peek 값으로 복원
   - 페이드 오버레이 다시 표시

## 변경 범위

| 파일 | 변경 내용 |
|------|----------|
| `src/components/dashboard/ServerDashboard.tsx` | 그리드 컨테이너에 max-height + 페이드 오버레이 추가 |
| `src/components/dashboard/ServerDashboard.tsx` | `initialVisibleRows` 계산 → peek용 행 수로 조정 (1행 기준) |

> **변경 없음**: `ImprovedServerCard.tsx`, `DashboardContent.tsx`, `DashboardRoutedContent.tsx`
> Props 인터페이스(`initialVisibleRows`)는 유지 — 호출부 수정 불필요

## 계약 (Contract)

```typescript
// peek 상태: max-height로 1.5행만 노출
// 확장 상태: max-height 없음 (혹은 매우 큰 값)
// 전환: CSS transition-all duration-300

// 그리드 wrapper
<div
  className="relative overflow-hidden transition-all duration-300"
  style={{ maxHeight: isPeeking ? PEEK_HEIGHT : 'none' }}
>
  {/* 서버 카드 grid */}
  {/* 페이드 오버레이 */}
  {isPeeking && (
    <div className="absolute bottom-0 left-0 right-0 h-20
                    bg-gradient-to-t from-white via-white/70 to-transparent
                    pointer-events-none" />
  )}
</div>
```

## 테스트 시나리오

- [ ] 초기 렌더: 1.5행 분량만 보이고 나머지는 페이드로 가려짐
- [ ] "더 보기" 클릭: 카드 그리드가 부드럽게 확장되고 페이드 사라짐
- [ ] "접기" 클릭: 다시 1.5행으로 수축, 페이드 복원
- [ ] 뷰 모드 전환(촘촘히/넓게): peek 높이가 올바르게 재계산됨
- [ ] 서버가 initialVisibleRows 이하일 때: peek 오버레이 미표시 (더 볼 것 없음)
- [ ] 모바일(1열): 카드 높이 기반 peek 높이 정상 동작

## SDD 게이트

- Status: **Approved** — 구현 착수 가능
- failing test 선행 커밋: `test(spec): server card peek UX add failing tests`
- 구현 커밋: `feat(dashboard): server card grid peek UX with fade overlay`

## 진행 기록

- 2026-05-15 Codex: TODO Active Task와 계획서 메타데이터를 확인했고, 본문 SDD 상태 표기를 `Approved`로 정정했다. 신규 UI 동작이므로 failing test 선행 커밋 후 구현한다.

## 보류 항목 (이번 범위 외)

- 서버 카드 내용 자체 수정 (분석 보고서의 다른 개선 항목)
- activeTab dead state 제거 (별도 리팩터)
- DashboardSummary 숫자 중복 제거 (별도 리팩터)
