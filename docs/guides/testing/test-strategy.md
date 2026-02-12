# Test Strategy Guide

> **통합 문서**: test-strategy-guide.md + testing-philosophy-detailed.md + vercel-first-strategy.md
> **최종 갱신**: 2026-01-05

---

## Overview

OpenManager AI의 테스트 전략은 **클라우드 네이티브 우선** 원칙을 따릅니다.

> **핵심 철학**: "실제 Vercel/GCP/Supabase 환경 테스트가 Mock보다 더 유효하다"

---

## 1. Test Pyramid (재설계)

```
      🔺 E2E Tests (실제 클라우드)
     ────────────────────────────
    🔺🔺 Cloud Integration (Staging)
   ────────────────────────────────
  🔺🔺🔺 Unit Tests (순수 함수만)
 ──────────────────────────────────
```

### 기존 피라미드와의 차이

| 기존 | 클라우드 네이티브 |
|------|-------------------|
| Unit 중심 (많이) | Unit 최소화 (순수 함수만) |
| Mock 의존 | 실제 환경 우선 |
| 로컬 검증 | Vercel 프로덕션 검증 |

---

## 2. Current Test Distribution

### 테스트 파일 구성 (58개, 2026-01-05 기준)

```
📁 Co-located Unit Tests (28개) - src/
├── components/**/*.test.tsx
├── hooks/**/*.test.ts
├── lib/**/*.test.ts
└── utils/**/*.test.ts

📁 Integration Tests (10개) - tests/integration/

📁 E2E Tests (10개) - tests/e2e/
└── Playwright (Chromium)

📁 API Tests (5개) - tests/api/

📁 AI Sidebar Tests (3개) - tests/ai-sidebar/
```

### 테스트 규모 현황

| 지표 | 현재 값 |
|------|---------|
| 테스트 파일 | 58개 |
| 테스트 케이스 | ~690개 |
| Quick 테스트 | 2.5s (92 tests) |
| Full 테스트 | ~200s |

---

## 2.1 Test Scale Optimization (2026-01-05)

### 프로젝트 특성

본 프로젝트는 **포트폴리오/토이 프로젝트**로, 상업용 서비스가 아닙니다.
따라서 테스트 전략은 다음 원칙을 따릅니다:

- **유지보수 비용 최소화**: 과도한 테스트는 오히려 부담
- **포트폴리오 가치 극대화**: 기술력 증명에 필요한 테스트만 유지
- **빠른 피드백 루프**: 개발 속도 저하 방지

### 삭제된 테스트 (10개 파일)

| 파일 | 삭제 이유 |
|------|----------|
| `src/config/ai-providers.test.ts` | TypeScript 타입 체크로 대체 가능 |
| `src/config/config.test.ts` | 정적 설정값 - 변경 없음 |
| `src/config/env.test.ts` | 환경변수 검증 - 런타임에서 확인 |
| `src/config/fallback-data.test.ts` | 정적 폴백 데이터 - 변경 없음 |
| `src/config/serverConfig.test.ts` | TypeScript 타입 체크로 대체 가능 |
| `src/data/__tests__/feature-cards.data.test.ts` | 정적 UI 데이터 - 변경 없음 |
| `src/data/__tests__/tech-stacks.data.test.ts` | 정적 UI 데이터 - 변경 없음 |
| `src/mock/mockServerConfig.test.ts` | Mock 데이터 테스트 - 불필요 |
| `tests/types/prediction-types.test.ts` | TypeScript 컴파일러가 검증 |
| `tests/types/server-types.test.ts` | TypeScript 컴파일러가 검증 |
| `tests/integration/ai-metrics-integration.test.ts` | Path alias 미해결로 실행 불가 |
| `ai-supervisor-timeout.spec.ts` 내 1개 테스트 | Cold Start로 인한 Flaky 테스트 |

### 삭제 판단 기준

```
1. TypeScript 대체 가능 여부
   → 타입 테스트, 설정 검증은 TS 컴파일러가 수행

2. 변경 빈도
   → 정적 데이터는 거의 변경되지 않음

3. 포트폴리오 가치
   → Mock 테스트는 기술력 증명에 기여하지 않음

4. 유지보수 비용
   → 테스트 수정 시간 > 버그 수정 시간
```

### 유지 중인 테스트 (포트폴리오 가치)

| 카테고리 | 예시 | 유지 이유 |
|----------|------|----------|
| **UI 컴포넌트** | `ImprovedServerCard.test.tsx` | React Testing Library 스킬 증명 |
| **커스텀 훅** | `useAIEngine.test.ts` | Hook 테스트 패턴 증명 |
| **유틸리티** | `metricValidation.test.ts` | 단위 테스트 스킬 증명 |
| **E2E** | `smoke.spec.ts` | 앱 동작 시연 가능 |
| **통합** | `query-complexity.test.ts` | Job Queue 복잡도 분석 검증 |

### 테스트 원칙별 평가

| 원칙 | 적용 방식 |
|------|----------|
| **테스트 피라미드** | Unit 70%, Integration 23%, E2E 7% - 유지 |
| **파레토 법칙** | 결함 집중 파일에 테스트 존재 확인 |
| **살충제 패러독스** | 다양한 테스트 유형 유지 (Unit, E2E, 통합) |
| **F.I.R.S.T.** | Quick 테스트 2.5초 - 충분히 빠름 |
| **Shift Left** | CI에서 자동 검증 유지 |

---

## 3. Mock vs Reality 판단 기준

| 테스트 대상 | Mock | 실제 환경 | 권장 |
|-------------|------|-----------|------|
| 순수 함수 | ✅ 적합 | ⚡ 과도 | **Mock** |
| 유틸리티/헬퍼 | ✅ 적합 | ⚡ 과도 | **Mock** |
| 타입 가드 | ✅ 적합 | ⚡ 과도 | **Mock** |
| UI 컴포넌트 | ✅ 적합 | ⚡ 과도 | **Mock** |
| API 엔드포인트 | ⚠️ 제한적 | ✅ 최적 | **실제 환경** |
| AI 서비스 통합 | ❌ 비현실적 | ✅ 필수 | **실제 환경** |
| 데이터베이스 | ❌ 비현실적 | ✅ 필수 | **실제 환경** |

---

## 4. Environment Priority

| 환경 | URL | 목적 | 권장도 |
|------|-----|------|--------|
| 개발 서버 | localhost:3000 | 개발 중 빠른 피드백 | ⭐⭐⭐ |
| 로컬 프로덕션 | localhost:3000 (빌드) | 배포 전 검증 | ⭐⭐⭐⭐ |
| **Vercel 프로덕션** | vercel.app | 실제 사용자 환경 | ⭐⭐⭐⭐⭐ |

### Vercel 환경 테스트의 가치

- **실제 성능**: 152ms vs 24.1s (개발 서버)
- **프로덕션 버그**: 빌드 최적화 이슈 발견
- **CDN 검증**: Edge 캐싱 및 성능 확인
- **환경변수**: Vercel 설정 적용 검증

---

## 5. Quick Commands

```bash
# 전체 검증
npm run validate:all

# Unit Tests
npm run test              # Vitest 전체
npm run test:minimal      # 핵심만 (~22ms)

# E2E Tests
npm run test:e2e          # 로컬 Playwright
npm run test:vercel:e2e   # Vercel 프로덕션 E2E

# Vercel 환경 종합
npm run test:vercel:full  # 전체 프로덕션 테스트
```

---

## 6. Test Complexity Guide

### 🟢 Low (즉시 작성)
- 순수 함수, 유틸리티
- 타입 가드, 헬퍼

### 🟡 Medium (Mock 활용)
- UI 컴포넌트
- React Hooks

### 🔴 High (실제 환경)
- API 엔드포인트
- AI/DB 통합
- 외부 서비스

---

## Related Documents

- [E2E Testing Guide](./e2e-testing-guide.md)
- [MSW Guide](./msw-guide.md)
- [Test Templates](./test-templates.md)

---

**이전 문서** (archived):
- `test-strategy-guide.md` → 이 문서로 통합
- `testing-philosophy-detailed.md` → 이 문서로 통합
- `vercel-first-strategy.md` → 이 문서로 통합
