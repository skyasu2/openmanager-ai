# OpenManager AI E2E 테스트 가이드

> Playwright 기반 End-to-End 테스트 범위와 실행/운영 가이드
> Owner: documentation
> Status: Active Canonical
> Doc type: How-to
> Last reviewed: 2026-02-21
> Canonical: docs/guides/testing/e2e-testing-guide.md
> Tags: testing,e2e,playwright

---

## 개요

현재 E2E는 **로컬 핵심 사용자 플로우 회귀**에 집중합니다.

- 목적: "앱이 실제 브라우저에서 깨지지 않는가"를 빠르게 확인
- 범위: 로그인/게스트/대시보드/접근성/오류 복구
- 원칙: AI 실추론 기반 장시간 시나리오는 자동 E2E에서 제외

---

## 유지 중인 E2E 스펙

- `tests/e2e/smoke.spec.ts`
- `tests/e2e/guest.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `tests/e2e/dashboard-server-cards.spec.ts`
- `tests/e2e/dashboard-ai-sidebar.spec.ts`
- `tests/e2e/dashboard-alerts-logs.spec.ts`
- `tests/e2e/login.spec.ts`
- `tests/e2e/error-boundary.spec.ts`
- `tests/e2e/system-boot.spec.ts`

---

## 실행 명령

```bash
# 로컬 핵심 E2E(smoke, 기본)
npm run test:e2e

# 전체 E2E (필요 시)
npm run test:e2e:all

# AI 태그 제외 실행
npm run test:e2e:no-ai

# 외부 의존 시나리오만 분리 실행 (@external)
npm run test:e2e:external

# 핵심 게이트(권장)
npm run test:e2e:critical

# 개발 서버 포함 1회 실행
npm run test:e2e:with-server
```

> `test:e2e:external`는 `--pass-with-no-tests` 옵션을 사용합니다.
> 현재 `@external` 테스트가 없으면 0건 통과로 종료되는 것이 의도된 동작입니다.

---

## 운영 원칙

### 1) 기본은 로컬

- E2E는 `playwright.config.ts` 기준 로컬 앱 대상으로 실행
- 원격 Vercel URL 직격 테스트는 기본 스크립트에서 제외

### 2) AI 검증은 계약 테스트로 대체

- AI 품질 자동화는 `Vitest + Contract`에서 처리
- E2E에서는 "UI가 동작하는가"만 확인

### 3) 실패 분류

- 셀렉터/렌더 실패: 프론트 회귀
- 네트워크/응답 대기 실패: 테스트 타임아웃 설계 문제 가능성 우선 검토
- 동일 시나리오 flaky 반복 시 E2E에서 제거 후 계약 테스트로 이동

---

## 새 E2E 추가 기준

아래를 모두 만족할 때만 추가합니다.

1. 브라우저 상호작용이 반드시 필요한가?
2. 단위/계약 테스트로 대체 불가능한가?
3. 30초 내 안정적으로 종료되는가?
4. 외부 유료 API 호출 없이 재현 가능한가?

---

## 디버깅 빠른 절차

```bash
# 1) 단일 스펙 재실행
npx playwright test tests/e2e/smoke.spec.ts --project=chromium

# 2) 트레이스 확인
npx playwright show-trace test-results/**/trace.zip

# 3) 콘솔/네트워크 확인
# 필요 시 spec 내부에서 page.on('console'|'requestfailed') 임시 로깅
```

---

## Related

- [Test Strategy Guide](./test-strategy.md)
- [Playwright Config](../../../playwright.config.ts)
