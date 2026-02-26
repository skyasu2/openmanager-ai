# Test Strategy Guide

> OpenManager 테스트 전략과 우선순위를 정의한 가이드
> Owner: documentation
> Status: Active
> Doc type: How-to
> Last reviewed: 2026-02-22
> Canonical: docs/guides/testing/test-strategy.md
> Tags: testing,strategy,quality

---

## Overview

OpenManager AI의 기본 테스트 전략은 **Local-First + Contract-First** 입니다.

- 기본 검증 경로는 `Vitest + MSW` 기반 로컬 테스트
- 외부 API/LLM 실호출은 자동 회귀에서 제외
- Playwright는 로컬 핵심 사용자 플로우 검증에 한정
- Playwright 구성(Chromium 단일, DevTools 비활성화, Vercel bypass header)은 유지하고 `test:e2e:critical`을 CI push/PR 게이트에 포함

> 핵심 원칙: 무료 티어를 보호하면서도, 회귀를 빠르게 탐지한다. "과도한 텍스트 기반 커버리지(%) 쫓기"를 철저히 배제하고 작동 검증에만 집중한다.

---

## 1. Test Pyramid (운영 기준)

```
      🔺 제한적 수동 스모크 (선택)
     ──────────────────────────
    🔺🔺 로컬 핵심 E2E (Playwright)
   ────────────────────────────
  🔺🔺🔺 계약/단위 테스트 (Vitest + MSW)
 ─────────────────────────────────────
```

### 레이어별 역할

| 레이어 | 도구 | 목적 | 기본 실행 |
|------|------|------|-----------|
| 계약/단위 | Vitest, MSW, Zod | 요청/응답 형식, 상태 전이, UI 로직 | 항상 |
| 로컬 핵심 E2E | Playwright | 게스트 로그인, 대시보드 렌더, 핵심 상호작용 | CI Push/PR + 필요 시 로컬 |
| 수동 스모크 | 브라우저 + health check | 배포 직후 최소 생존 확인 | 선택 |

## 1.5 테스트 커버리지 정책 (Coverage Policy)

> **"숫자 채우기식 테스트 커버리지(%) 달성 지양"**

1인 개발 포트폴리오 및 Vibe Coding의 특성 상, 과도한 단위 테스트 작성을 강제하지 않습니다.
- **Coverage Tool (Istanbul/v8) 미사용**: 80% 이상 커버리지 달성 같은 인위적인 지표를 목표로 삼지 않습니다.
- **실용주의 (Pragmatism)**: "수정했을 때 화면이 터지지 않는가?", "API가 에러를 뱉지 않는가?" 를 즉각 확인하는 스모크 방식에 집중합니다.
- **AI 한계 인정**: AI 코딩의 생산성을 극한으로 끌어올리려면, 테스트 코드 작성에 AI 토큰과時間を 낭비하기보다 핵심 비즈니스 로직(계약/스키마) 검증에 집중해야 합니다.

---

## 2. What We Test By Default

### 포함

- React 컴포넌트/훅 상태 전이
- AI 요청 payload 계약 (`messages`, `sessionId`, headers)
- AI 스트림 이벤트 형식(SSE data event 구조)
- 대시보드 핵심 렌더링/접근성/오류 페이지

### 기본 제외

- PR/로컬 자동화에서의 실 LLM 추론 호출
- Vercel 프로덕션 URL 직격 자동 E2E
- 장시간(분 단위) 네트워크 대기 기반 테스트

---

## 3. Commands (현재 표준)

```bash
# 빠른 로컬 회귀
npm run test:quick

# 계약 테스트 묶음
npm run test:contract

# 로컬 핵심 E2E
npm run test:e2e:critical

# 개발 중 최소 게이트
npm run test:gate

# 전체(필요 시)
npm run validate:all
```

---

## 4. CI/Release Gate (실행 주기 조율)

### Push 기본 게이트 (feature/develop)

1. `npm run test:quick`
2. `npm run type-check`
3. `npm run lint`
4. `npm run test:e2e:critical`

### Pull Request 게이트 (main 병합 전)

1. `npm run test:gate`
2. `npm run test:e2e:critical`
3. `npm run test:cloud:essential` (Cloud Run 변경 시)

### 정기/수동 Deep Gate (선택)

1. `npm run test:e2e:all`
2. `npm run test:e2e:external` (외부 의존 시나리오 점검 시)

---

## 5. Cost Guardrails

- 무료 티어 보호를 위해 테스트 기본값은 외부 서비스 호출 0회에 가깝게 유지
- 실추론/실클라우드 검증이 꼭 필요하면 수동 1회 스모크로 제한
- 새 테스트 작성 시 "이 테스트가 외부 토큰/요금을 소비하는가"를 먼저 판단
- CI 사용량 급증을 막기 위해 E2E는 `critical` 스위트만 push/PR에서 자동 실행하고, `all/external`은 정기/수동으로 분리

---

## 6. Flaky Guardrails (AI 비결정성 대응)

- AI 답변의 정확 문장/수치 문자열 매칭(assert) 금지
- E2E에서는 렌더링 컨테이너, 상태 전이, 오류 복구 등 안정 신호만 검증
- AI 응답 검증은 `test:contract` + MSW 모킹으로 우선 처리
- 동일 시나리오가 반복 flaky면 E2E에서 제거하고 계약 테스트로 전환

---

## 7. Mock Integrity Rules (무의미 통과 방지)

- 목업은 실코드와 분리된 하드코딩 객체를 복제하지 않고, 가능한 한 실제 모듈을 기준(`importOriginal`)으로 부분 오버라이드한다.
- 설정/스키마/에이전트 목록 테스트는 "실제 source of truth를 기반으로 생성한 목업"만 허용한다.
- API 응답 목업은 Zod/계약 테스트(`test:contract`)와 함께 관리해 필드 추가/삭제 시 테스트가 즉시 실패하도록 유지한다.
- "목업만 맞아서 통과"하는 케이스를 줄이기 위해, 핵심 경로는 최소 1개 이상 실제 설정 참조 테스트를 함께 둔다.

---

## Related Documents

- [E2E Testing Guide](./e2e-testing-guide.md)
- [Quick Start](../../QUICK-START.md)
- [AI Standards](../ai/ai-standards.md)
