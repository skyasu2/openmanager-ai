# 로그인 페이지 개선 계획서

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Tags: frontend,login,auth,bug-fix,refactor

---

## 배경 및 분석 범위

2026-05-16 로그인 페이지 전체(page.tsx, LoginClient.tsx, LoginButtons.tsx, 3개 훅, login.constants.ts, error.tsx)를 코드 수준에서 분석했다. **즉시 수정 버그 2건**, **소규모 리팩터링 3건**, **정비 2건**이 확인되었다. 전부 프론트엔드 코드 변경만이며 외부 인프라 변경 없다.

---

## 사전 검증 결과 요약

### ✅ 수정 대상

| # | 분류 | 항목 | 파일 | 우선순위 |
|---|------|------|------|---------|
| L1 | 버그 | 게스트 PIN 에러와 메인 카드 에러 이중 표시 | `LoginClient.tsx` | P1 |
| L2 | 버그 | OAuth 중 취소 버튼 표시 (실제 취소 불가) | `LoginButtons.tsx` | P1 |
| L3 | 리팩터 | `LoadingType` 타입 중복 정의 | `LoginClient.tsx`, `LoginButtons.tsx`, `useLoadingMessages.ts` | P2 |
| L4 | 리팩터 | 버튼 스타일 3개 상수 부모→자식 props 전달 | `LoginClient.tsx`, `LoginButtons.tsx` | P2 |
| L5 | UX | 이메일 Magic Link 발송 성공 후 입력 필드 미초기화 | `LoginButtons.tsx`, `LoginClient.tsx` | P2 |
| L6 | 정비 | `login.constants.ts` 미사용 상수 2개 | `login.constants.ts` | P3 |
| L7 | 정비 | `login/error.tsx` 인라인 style 객체 → Tailwind | `login/error.tsx` | P3 |
| L8 | 정비 | `page.tsx` 완료된 마이그레이션 주석 | `page.tsx` | P3 |

### ❌ 분석 후 수정 불필요로 판정된 항목

| 항목 | 판정 근거 |
|------|----------|
| OAuth 취소 실제 구현 | `signInWithOAuthProvider` 호출 시 브라우저 리다이렉트가 이미 시작됨. React AbortController로 차단 불가. 버튼 숨기기(L2)가 현실적 해결책 |
| 이메일 state를 `LoginClient`로 이동 | `LoginButtons`의 내부 state를 부모로 올리면 `LoginButtons` 인터페이스 대규모 변경. `onEmail` async success boolean 계약(L5)이 더 낮은 리스크 |
| `app/error.tsx` 동시 수정 | `app/error.tsx`도 inline style 사용하나 본 계획 범위 초과. 별도 TODO.md 1줄 기록으로 충분 |

---

## 무료 티어 영향 분석

모든 작업이 프론트엔드 코드 변경만이며 인프라 변경 없다.

| 플랫폼 | 영향 | 판정 |
|--------|------|------|
| Vercel Pro | 변경 없음 (Standard build) | ✅ 영향 없음 |
| Cloud Run | 변경 없음 | ✅ 영향 없음 |
| Upstash Redis | 변경 없음 | ✅ 영향 없음 |
| Supabase | 변경 없음 | ✅ 영향 없음 |

---

## SDD 게이트 판정

모든 항목이 **단일 버그 수정 또는 소규모 리팩터링**이므로 `test(spec):` 선행 커밋 없이 `fix/refactor + test 동시 커밋` 허용.

> 승인 상태: 2026-05-16 계획서 재검토 기준으로 각 항목의 영향 파일, 제외 범위, 검증 게이트가 확정되어 구현 착수 가능. `app/error.tsx` 정비는 범위 밖 backlog로 분리한다.

---

## L1: 게스트 PIN 에러 이중 표시 수정

### 현상

`errorMessage` state 하나가 메인 카드 에러 박스(265줄)와 게스트 PIN 다이얼로그 에러 박스(291줄) 양쪽에 동시에 바인딩되어 있다. PIN 실패 시 Dialog 안과 배경 카드에서 같은 에러 메시지가 동시에 보인다.

```tsx
// LoginClient.tsx:265 — 메인 카드 (항상 표시)
{errorMessage && <div>...{errorMessage}</div>}

// LoginClient.tsx:291 — 게스트 PIN 다이얼로그 (항상 표시)
{errorMessage && <div>...{errorMessage}</div>}
```

### 수정 방향

1. 게스트 모달이 열려 있는 동안 메인 카드 에러 박스 숨기기
2. 모달을 닫을 때 에러를 클리어해 post-close 상태 오염 방지

```tsx
// 수정 전
{errorMessage && (
  <div>...</div>
)}
// onOpenChange={(open) => setIsGuestModalOpen(open)}

// 수정 후
{errorMessage && !isGuestModalOpen && (
  <div>...</div>
)}
// onOpenChange={(open) => {
//   setIsGuestModalOpen(open);
//   if (!open) setErrorMessage(null);
// }}
```

### 작업 범위

- [x] **L1-1**: 메인 카드 에러 조건에 `!isGuestModalOpen` 추가
- [x] **L1-2**: `Dialog.onOpenChange`에서 모달 닫힐 때 `setErrorMessage(null)` 호출

**영향 파일:**
- `src/app/login/LoginClient.tsx`

---

## L2: OAuth 중 취소 버튼 숨기기

### 현상

`LoginButtons.tsx:168`에서 `isLoading` 조건만으로 취소 버튼을 표시한다. GitHub/Google OAuth 로딩 시에도 취소 버튼이 나타나지만, 브라우저 리다이렉트가 이미 진행 중이므로 버튼을 눌러도 OAuth 흐름을 중단할 수 없다.

```tsx
// 현재 — 모든 로딩 상태에서 표시
{isLoading && (
  <button onClick={onCancel}>취소</button>
)}
```

### 수정 방향

취소 버튼을 게스트·이메일 로딩일 때만 표시한다.

```tsx
// 수정 후
{isLoading && (loadingType === 'guest' || loadingType === 'email') && (
  <button onClick={onCancel}>취소</button>
)}
```

### 작업 범위

- [x] **L2-1**: `LoginButtons.tsx` 취소 버튼 조건에 `loadingType === 'guest' || loadingType === 'email'` 추가

**영향 파일:**
- `src/app/login/LoginButtons.tsx`

---

## L3: `LoadingType` 타입 중복 정의 제거

### 현상

동일 타입이 세 파일에 각자 정의되어 있다.

```typescript
// LoginClient.tsx:50
useState<'github' | 'guest' | 'google' | 'email' | null>(null)

// LoginButtons.tsx:6
type LoadingType = 'github' | 'guest' | 'google' | 'email' | null;

// hooks/useLoadingMessages.ts:12
type LoadingType = 'github' | 'guest' | 'google' | 'email' | null;
```

### 수정 방향

`login.constants.ts`에 `export type LoadingType` 추가, 양쪽 파일에서 import.

```typescript
// login.constants.ts에 추가
export type LoadingType = 'github' | 'guest' | 'google' | 'email' | null;

// LoginClient.tsx — useState에서 import
import type { LoadingType } from './login.constants';

// LoginButtons.tsx — 타입 정의 제거 후 import
import type { LoadingType } from './login.constants';
```

### 작업 범위

- [x] **L3-1**: `login.constants.ts`에 `export type LoadingType` 추가
- [x] **L3-2**: `LoginClient.tsx` 인라인 타입 → import로 교체
- [x] **L3-3**: `LoginButtons.tsx` 로컬 타입 정의 제거 → import로 교체
- [x] **L3-4**: `hooks/useLoadingMessages.ts`/`useGuestLogin.ts` 로컬 타입 정의 제거 → import로 교체

**영향 파일:**
- `src/app/login/login.constants.ts`
- `src/app/login/LoginClient.tsx`
- `src/app/login/LoginButtons.tsx`
- `src/app/login/hooks/useLoadingMessages.ts`

---

## L4: 버튼 스타일 상수 `LoginButtons` 내부로 이동

### 현상

버튼의 시각 스타일이 부모(`LoginClient`)에 정의되어 props로 자식(`LoginButtons`)에 전달된다.

```typescript
// LoginClient.tsx:92 — 부모가 자식의 스타일을 알고 있음
const glassButtonBaseClass = 'group relative flex h-12 w-full ... (70자)';
const providerOverlayClass = 'pointer-events-none absolute inset-0 ... (90자)';
const guestOverlayClass    = 'pointer-events-none absolute inset-0 ... (90자)';

// LoginButtonsProps에 3개 string prop 존재
glassButtonBaseClass: string;
providerOverlayClass: string;
guestOverlayClass: string;
```

### 수정 방향

`LoginButtons.tsx` 내부에 3개 상수를 직접 정의하고 `LoginButtonsProps`에서 3개 prop 제거.

이메일 버튼의 오버라이드(`bg-slate-800! text-white! hover:bg-slate-700! hover:border-slate-600!`)는 `LoginButtons` 내부에서 별도 상수(`emailButtonOverrideClass`)로 관리.

### 작업 범위

- [x] **L4-1**: `LoginButtons.tsx`에 3개 스타일 상수 직접 정의
- [x] **L4-2**: `LoginButtonsProps`에서 `glassButtonBaseClass`, `providerOverlayClass`, `guestOverlayClass` 제거
- [x] **L4-3**: `LoginClient.tsx`에서 3개 상수 정의 제거 및 props 전달 제거

**영향 파일:**
- `src/app/login/LoginButtons.tsx`
- `src/app/login/LoginClient.tsx`

---

## L5: 이메일 발송 성공 후 입력 필드 초기화

### 현상

`LoginButtons` 내부 `email` state가 `onEmail(email)` 호출 후 초기화되지 않는다. Magic Link 발송 성공 메시지가 표시된 이후에도 이메일 주소가 입력 필드에 남아있다.

`LoginClient.handleEmailLogin`이 성공 여부를 알지만 `email` state는 `LoginButtons` 내부에 있어 직접 초기화 불가.

### 수정 방향

`LoginButtonsProps.onEmail`을 성공 여부를 반환하는 async 계약으로 바꾼다. `LoginClient.handleEmailLogin()`이 Magic Link 발송 성공 시 `true`, 실패 시 `false`를 반환하고, `LoginButtons`는 `await onEmail(email)` 결과가 `true`일 때만 내부 `email` state를 초기화한다.

```typescript
// LoginButtonsProps 변경
onEmail: (email: string) => Promise<boolean>;

// LoginButtons 내부
const handleEmailSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (email && !isLoading) {
    const sent = await onEmail(email);
    if (sent) setEmail('');
  }
};
```

### 작업 범위

- [x] **L5-1**: `LoginButtonsProps.onEmail` 타입을 `(email: string) => Promise<boolean>`로 변경
- [x] **L5-2**: `LoginClient.handleEmailLogin`이 성공/실패 boolean을 반환하도록 변경
- [x] **L5-3**: `LoginButtons.handleEmailSubmit`을 async로 변경하고 성공 시 `setEmail('')` 실행
- [x] **L5-4**: `<LoginButtons onEmail={handleEmailLogin}>` 형태로 전달해 void wrapper 제거

**영향 파일:**
- `src/app/login/LoginButtons.tsx`
- `src/app/login/LoginClient.tsx`

---

## L6: `login.constants.ts` 미사용 상수 제거

### 현상

```typescript
// login.constants.ts:3,5
const _COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;     // export 없음, 사용 없음
const _PULSE_ANIMATION_DURATION_MS = 600;          // export 없음, 사용 없음
```

### 작업 범위

- [x] **L6-1**: `_COOKIE_MAX_AGE_SECONDS` 삭제
- [x] **L6-2**: `_PULSE_ANIMATION_DURATION_MS` 삭제

**영향 파일:**
- `src/app/login/login.constants.ts`

---

## L7: `login/error.tsx` Tailwind 전환

### 현상

```tsx
// login/error.tsx — 인라인 style 객체
<div style={{ display: 'flex', background: '#0f172a', color: 'white', ... }}>
<button style={{ padding: '10px 20px', backgroundColor: '#0070f3', ... }}>
```

로그인 페이지는 `slate-900` 다크 배경 기반인데, error.tsx만 raw CSS 색상값(#0f172a = slate-900, #0070f3 ≈ blue-600)을 사용한다. `dashboard/error.tsx` 패턴(Tailwind + shadcn Button)을 참고해 통일.

로그인 에러는 로그인 페이지의 dark 컨텍스트에 맞게 `bg-slate-900 text-white` 기반으로 작성.

### 작업 범위

- [x] **L7-1**: `login/error.tsx` style 객체 → Tailwind 클래스로 교체
- [x] **L7-2**: reset 버튼 → Tailwind 스타일 적용

**영향 파일:**
- `src/app/login/error.tsx`

---

## L8: `page.tsx` 완료 마이그레이션 주석 제거

### 현상

```tsx
// page.tsx:13
// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)
```

마이그레이션이 이미 완료된 후 남겨진 임시 주석.

### 작업 범위

- [x] **L8-1**: 완료된 마이그레이션 주석 삭제

**영향 파일:**
- `src/app/login/page.tsx`

---

## 검증 게이트

```bash
npm run type-check
npm run lint
npm run test:quick
npm run line-guard
```

### 완료 검증

- `npm run type-check` PASS
- `npm run lint` PASS (기존 `reports/qa/qa-tracker.json` size info only)
- `npm run test:quick` PASS

---

## 작업 순서 및 의존성

```
L1 (에러 이중 표시) → 독립, 먼저 처리 권장
L2 (취소 버튼)      → 독립
L3 + L6 + L8       → 독립, 동일 커밋 묶기 가능 (타입/상수/주석 정비)
L4 (스타일 이동)    → L3 이후 권장 (LoadingType import 정리 후)
L5 (이메일 초기화)  → L4 이후 권장 (props 인터페이스 안정 후)
L7 (error.tsx)     → 독립
```

권장 커밋 묶음:
```
커밋 1: fix(login): separate guest modal error from main card error [L1]
커밋 2: fix(login): hide cancel button during OAuth redirect [L2]
커밋 3: refactor(login): extract LoadingType, remove dead constants [L3+L6+L8]
커밋 4: refactor(login): move button styles into LoginButtons [L4]
커밋 5: fix(login): reset email field after magic link success [L5]
커밋 6: style(login): convert error.tsx to Tailwind [L7]
```

---

## 이번 작업에서 의도적으로 제외한 항목

| 항목 | 제외 이유 |
|------|----------|
| OAuth 취소 실제 구현 | 브라우저 리다이렉트 진행 중 React level 취소 불가. L2로 UX 오해 방지 충분 |
| email state → LoginClient 이동 | LoginButtons 인터페이스 대규모 변경. `onEmail` async success boolean 계약(L5)으로 충분 |
| `app/error.tsx` Tailwind 전환 | 본 계획 범위 초과. TODO.md 별도 1줄 기록 |
| 로딩 메시지 시각 노출 | 현재 `sr-only` 처리는 의도적 설계 (버튼 내 스피너가 시각 피드백). 변경 시 레이아웃 영향 큼 |
