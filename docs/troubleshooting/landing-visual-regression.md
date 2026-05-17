> Owner: project
> Status: Active Supporting
> Doc type: How-to
> Last reviewed: 2026-05-18
> Tags: regression, font, landing, ai-agent, scope-contamination

# 랜딩 페이지 시각 회귀 방지 가이드

## 발생한 회귀 (2026-05-17)

### 타임라인

| 시각 | 커밋 | 내용 |
|------|------|------|
| 04:02 | `092e36c0a style(font)` | `next/font/google` Noto Sans KR self-host, hero typography 개선 |
| 12:32 | `9dd0404f8 chore(docs)` | docs 업데이트 **명목으로** font/typography 변경 전부 되돌림 |
| (복구) | `e243d2649 feat(landing)` | typography 부분 복구 + CustomCursor 추가 |

### `9dd0404f8`이 실제로 되돌린 것

```diff
// layout.tsx
- import { Noto_Sans_KR } from 'next/font/google';
- const notoSansKR = Noto_Sans_KR({ ... variable: '--font-noto-sans-kr' });
- <html className={notoSansKR.variable}>
+ <html>   // --font-noto-sans-kr CSS 변수 사라짐

// globals.css
- --font-family-sans: var(--font-noto-sans-kr), 'Noto Sans KR', ...
+ --font-family-sans: 'Inter', 'Noto Sans KR', ...   // 시스템 폰트 fallback만

// LandingPageRuntime.tsx
- tracking-tight / tracking-wide / tracking-widest / text-white/45→60
+ 모두 제거
```

### 근본 원인: AI 에이전트 scope 오염

`chore(docs)` 라벨을 달았으나 실제로는 `layout.tsx`, `globals.css`, `LandingPageRuntime.tsx`를 함께 수정했다. AI 에이전트(Codex)가 working tree에 아직 unstaged 상태였던 font 변경을 docs 커밋에 같이 묶어서 올린 것이 원인이다.

---

## 현재 미복구 상태: next/font

`e243d2649`에서 typography는 복구했으나 **`next/font/google` self-hosting은 아직 미복구**다.

현재 폰트 스택:
```css
--font-family-sans: 'Inter', 'Noto Sans KR', ui-sans-serif, system-ui, ...
```

'Inter'와 'Noto Sans KR'은 표준 시스템 폰트가 아니므로 실제로는 `ui-sans-serif`(Mac: SF Pro, Windows: Segoe UI)로 fallback된다.

복구 방법:
```typescript
// src/app/layout.tsx
import { Noto_Sans_KR } from 'next/font/google';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

// html 태그에 className 추가
<html lang="ko" suppressHydrationWarning className={notoSansKR.variable}>
```

```css
/* src/app/globals.css */
--font-family-sans: var(--font-noto-sans-kr), 'Noto Sans KR', ui-sans-serif, ...
```

> **주의**: Biome PostToolUse hook이 미사용 import를 자동 제거함.
> `className={notoSansKR.variable}`을 html 태그에 먼저 추가한 뒤 import를 추가할 것.

---

## 발견된 추가 문제

### 1. `cursor: none` scope 오염 (복구됨 — `e243d2649`)

`landing-effects.css`가 `page.tsx`와 `login/page.tsx` 양쪽에서 import된다.
`LoginClient.tsx`도 `.landing-visual-surface` 클래스를 사용하므로,
cursor CSS를 `.landing-visual-surface`에 걸면 로그인 페이지 커서도 사라진다.

**해결책**: `.has-custom-cursor` 클래스를 별도로 두고,
`<CustomCursor />`를 마운트하는 페이지에만 해당 클래스를 추가한다.

```tsx
// LandingPageRuntime.tsx — 홈 페이지만 has-custom-cursor
<div className="landing-visual-surface has-custom-cursor ...">
  <CustomCursor />
```

```tsx
// LoginClient.tsx — 커서 컴포넌트 없음, has-custom-cursor 클래스 없음
<div className="landing-visual-surface ...">
```

### 2. 낮은 contrast 텍스트 패턴

`text-white/30` 이하는 순수 black(`#000`) 배경에서 WCAG AA(4.5:1)를 만족하지 못한다.

| 위치 | 클래스 | 판단 |
|------|------|------|
| `LandingPageRuntime.tsx:152` | `text-white/30` | 의도적 eyebrow label — 허용 |
| `login/LoginButtons.tsx` | `text-white/40`, `text-white/35` | placeholder/아이콘 — 허용 |
| `system-boot` disabled 상태 | `text-white/40` | 비활성 상태 — 허용 |

실제 본문/헤드라인 텍스트에는 `/45` 이하를 쓰지 않는 것이 원칙이다.

---

## 재발 방지 체크리스트

### AI 에이전트가 커밋을 만들 때

- [ ] **커밋 scope와 실제 변경 파일 대조**: `chore(docs)` 커밋이면 `docs/`, `reports/` 외 파일이 포함되면 안 됨
- [ ] `git diff --stat`으로 파일 목록을 먼저 확인하고 의도치 않은 파일은 `git checkout -- <file>`로 제외
- [ ] 작업 전 `git stash` 또는 `git status`로 working tree가 깨끗한지 확인

### `layout.tsx` / `globals.css` 수정 시

- [ ] `next/font` 변수(`--font-noto-sans-kr`) 제거 여부 체크
- [ ] `html` 태그의 `className` 속성 유지 여부 체크
- [ ] 수정 후 `npm run type-check` 통과 확인

### CSS 유틸리티 파일(`landing-effects.css` 등) 수정 시

- [ ] 해당 CSS가 여러 페이지에서 import되는지 확인 (`grep -rn "landing-effects" src/`)
- [ ] 새 클래스가 공유 레이아웃 클래스(`.landing-visual-surface`)에 의도치 않게 결합되지 않는지 확인
- [ ] 기능별 스코프 클래스(예: `.has-custom-cursor`) 패턴 사용

### 시각적 회귀 감지

현재 E2E 스냅샷 테스트는 없다. 시각 회귀는 수동 확인에 의존한다.
`npm run dev:network` 후 브라우저에서 아래를 확인한다:

1. 폰트가 명확하게 렌더되는가 (시스템 폰트 fallback 여부)
2. h1 `OpenManager` 텍스트에 미세한 흰색 glow가 있는가
3. 로그인 페이지에서 마우스 커서가 보이는가
4. 홈 랜딩에서 커서가 dot+ring으로 교체되는가

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/app/layout.tsx` | `next/font` 로딩, html className |
| `src/app/globals.css` | `--font-family-sans` CSS 변수 |
| `src/app/LandingPageRuntime.tsx` | hero typography, `has-custom-cursor` 클래스 |
| `src/app/landing-effects.css` | `.has-custom-cursor` 커서 CSS (login 페이지 공유됨) |
| `src/components/landing/CustomCursor.tsx` | dot+ring 커서 컴포넌트 |
| `src/app/login/LoginClient.tsx` | `.landing-visual-surface` 사용, `has-custom-cursor` 없음 |
