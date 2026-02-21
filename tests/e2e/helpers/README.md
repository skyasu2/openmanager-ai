# E2E Test Helpers 가이드

최종 업데이트: 2026-02-21

---

## 목적

`tests/e2e/helpers`는 로컬 핵심 E2E에서 재사용하는 최소 헬퍼만 유지합니다.

- 공통 URL/환경 감지
- 게스트 로그인 및 기본 이동
- 타임아웃 상수/보안 유틸
- 반복 UI 플로우 함수

외부 AI/프로덕션 직격 전용 헬퍼는 제거되었습니다.

---

## 현재 헬퍼 목록

- `config.ts`: 베이스 URL, 환경 감지
- `featureFlags.ts`: E2E feature flag 보조
- `guest.ts`: 게스트 로그인/대시보드 진입
- `security.ts`: 안전한 셀렉터/입력 보조
- `timeouts.ts`: 공통 타임아웃 상수
- `ui-flow.ts`: 대시보드 공통 흐름 헬퍼

---

## 기본 사용 예시

```ts
import { test, expect } from '@playwright/test';
import { guestLogin } from './guest';
import { TIMEOUTS } from './timeouts';

test('guest can enter dashboard', async ({ page }) => {
  await guestLogin(page, { landingPath: '/' });
  await page.waitForURL('**/dashboard', { timeout: TIMEOUTS.NETWORK_REQUEST });
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
});
```

---

## 유지 원칙

1. 헬퍼는 외부 유료 API 호출을 강제하지 않는다.
2. 한 파일은 하나의 재사용 책임만 가진다.
3. 테스트에서 2회 이상 반복되는 로직만 헬퍼로 승격한다.
