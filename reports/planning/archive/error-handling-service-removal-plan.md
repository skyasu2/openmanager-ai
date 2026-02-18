# 에러 처리 서비스 제거 작업 계획서

**작성일**: 2026-01-22
**대상 디렉토리**: `src/services/error-handling/`
**현재 줄 수**: 2,350줄 (6개 파일)
**목표**: 완전 제거 (0줄)

---

## 1. 현황 분석

### 1.1 파일 구조 (2,350줄)

```
src/services/error-handling/
├── ErrorHandlingService.ts          (250줄) - 통합 서비스
├── core/
│   └── ErrorHandlingCore.ts         (266줄) - 핵심 로직
├── handlers/
│   └── DefaultErrorHandlers.ts      (339줄) - 핸들러 모음
├── monitoring/
│   └── ErrorMonitoringService.ts    (506줄) - 모니터링
├── recovery/
│   └── RecoveryService.ts           (632줄) - 복구 로직
└── types/
    └── ErrorTypes.ts                (357줄) - 타입 정의
```

### 1.2 사용처 분석

| 파일 | 사용 방식 | 실제 호출 |
|------|----------|:--------:|
| `service-registry.ts` | import + 등록 | ❌ |
| error-handling 내부 파일 | 상호 참조 | ❌ |

**결론**:
- `getErrorHandler()` 호출 **0건**
- DI 컨테이너에 등록만 되고 **사용되지 않음**

### 1.3 기존 에러 처리 현황

| 도구 | 역할 | 상태 |
|------|------|:----:|
| **Pino Logger** | 로깅 | ✅ 사용 중 |
| **Sentry** | 모니터링/에러 추적 | ✅ 사용 중 |
| **React Error Boundary** | UI 에러 격리 | ✅ 사용 중 |
| **error-handling/** | 중복 레이어 | ❌ 미사용 |

### 1.4 문제점

| 문제 | 설명 |
|------|------|
| 완전 미사용 | 2,350줄 데드 코드 |
| 중복 기능 | Pino + Sentry가 이미 담당 |
| 과잉 설계 | 5개 레이어 (Service → Core → Handlers → Monitoring → Recovery) |
| 유지보수 부담 | 타입/인터페이스 동기화 필요 |

---

## 2. 대체 방안: Pino + Sentry

### 2.1 현재 사용 중인 에러 처리 스택

```typescript
// src/lib/logging.ts - 이미 구현됨
import { logger } from '@/lib/logging';

// 에러 로깅
logger.error('에러 발생', { error, context });

// Sentry 자동 연동 (instrumentation.ts)
Sentry.captureException(error);
```

### 2.2 에러 처리 패턴 (Global Error Boundary)

```typescript
// app/global-error.tsx - 이미 구현됨
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorFallback onReset={reset} />;
}
```

### 2.3 비교표

| 기능 | error-handling/ | Pino + Sentry |
|------|:---------------:|:-------------:|
| 에러 로깅 | ✅ | ✅ (Pino) |
| 에러 모니터링 | ✅ (미사용) | ✅ (Sentry) |
| 에러 분류 | ✅ (17개 타입) | ✅ (Sentry 자동) |
| 복구 로직 | ✅ (미사용) | N/A |
| 사용 여부 | ❌ | ✅ |

---

## 3. 제거 계획

### 3.1 Phase 1: 의존성 분석

```bash
# 확인 완료: getErrorHandler() 호출 0건
grep -r "getErrorHandler" src/
# (service-registry.ts에서 export만 존재)
```

### 3.2 Phase 2: service-registry.ts 정리

**변경 전**:
```typescript
import { ErrorHandlingService } from '@/services/error-handling/ErrorHandlingService';

// ...

private registerErrorHandlingService(): void {
  registerFactory(
    SERVICE_TOKENS.ERROR_HANDLER,
    () => {
      const logger = container.resolve<ILogger>(SERVICE_TOKENS.LOGGER);
      return new ErrorHandlingService(logger);
    },
    'singleton',
    [SERVICE_TOKENS.LOGGER]
  );
}
```

**변경 후**:
```typescript
// import 제거

// registerErrorHandlingService() 메서드 제거
// doRegisterServices()에서 호출 제거
// getErrorHandler export 제거
```

### 3.3 Phase 3: 인터페이스 정리

**파일**: `src/lib/interfaces/services.ts`
```diff
- export interface IErrorHandler {
-   handle(error: unknown, context?: string): void;
-   isRetryable(error: unknown): boolean;
-   // ...
- }
```

### 3.4 Phase 4: DI 토큰 정리

**파일**: `src/lib/di-container.ts`
```diff
export const SERVICE_TOKENS = {
  LOGGER: Symbol.for('Logger'),
- ERROR_HANDLER: Symbol.for('ErrorHandler'),
  CONFIG_LOADER: Symbol.for('ConfigLoader'),
  // ...
};
```

### 3.5 Phase 5: 파일 삭제

```bash
# 전체 디렉토리 삭제
rm -rf src/services/error-handling/
```

---

## 4. 체크리스트

### 분석
- [x] 파일 구조 분석 (6개 파일, 2,350줄)
- [x] 사용처 분석 (`getErrorHandler()` 호출 0건)
- [x] 대체 솔루션 확인 (Pino + Sentry)

### Phase 1: 의존성 제거
- [ ] `src/lib/service-registry.ts`
  - [ ] import 제거
  - [ ] `registerErrorHandlingService()` 메서드 제거
  - [ ] `doRegisterServices()`에서 호출 제거
  - [ ] `getErrorHandler` export 제거

### Phase 2: 인터페이스 정리
- [ ] `src/lib/interfaces/services.ts`
  - [ ] `IErrorHandler` 인터페이스 제거

### Phase 3: DI 토큰 정리
- [ ] `src/lib/di-container.ts`
  - [ ] `ERROR_HANDLER` 토큰 제거

### Phase 4: 파일 삭제
- [ ] `src/services/error-handling/ErrorHandlingService.ts` 삭제
- [ ] `src/services/error-handling/core/ErrorHandlingCore.ts` 삭제
- [ ] `src/services/error-handling/handlers/DefaultErrorHandlers.ts` 삭제
- [ ] `src/services/error-handling/monitoring/ErrorMonitoringService.ts` 삭제
- [ ] `src/services/error-handling/recovery/RecoveryService.ts` 삭제
- [ ] `src/services/error-handling/types/ErrorTypes.ts` 삭제
- [ ] `src/services/error-handling/` 디렉토리 삭제

### Phase 5: 검증
- [ ] TypeScript 타입 검사 통과
- [ ] Biome lint 통과
- [ ] 빌드 성공
- [ ] 테스트 통과
- [ ] 로컬 개발 서버 정상 동작

---

## 5. 예상 결과

| 항목 | Before | After |
|------|:------:|:-----:|
| 파일 수 | 6개 | 0개 |
| 줄 수 | 2,350줄 | 0줄 |
| DI 등록 | 1개 | 0개 |
| 인터페이스 | 1개 | 0개 |

### 총 코드 감소량
```
-2,350줄 (error-handling/)
-   50줄 (service-registry.ts 정리)
-   30줄 (interfaces/services.ts)
-    5줄 (di-container.ts)
─────────────────────────────
≈ -2,435줄
```

---

## 6. 리스크 분석

| 리스크 | 영향도 | 가능성 | 대응 |
|--------|:------:|:------:|------|
| 숨겨진 사용처 | 높음 | 낮음 | grep으로 철저히 확인 |
| 빌드 실패 | 중간 | 낮음 | 단계별 검증 |
| 타입 오류 | 중간 | 중간 | interface 정리 후 타입 체크 |

---

## 7. 롤백 계획

```bash
# 문제 발생 시 커밋 되돌리기
git revert HEAD
```

또는 git stash로 작업 내용 보관 후 원복.

---

## 8. 향후 에러 처리 가이드

### 8.1 로깅
```typescript
import { logger } from '@/lib/logging';

logger.error('API 호출 실패', {
  endpoint: '/api/servers',
  error: error.message,
  statusCode: response.status
});
```

### 8.2 Sentry 모니터링
```typescript
import * as Sentry from '@sentry/nextjs';

try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { module: 'ai-engine' },
    extra: { context: 'supervisor' }
  });
  throw error; // 또는 graceful degradation
}
```

### 8.3 React Error Boundary
```typescript
// 컴포넌트 레벨 에러 격리
<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

---

## 9. 의존 파일 목록

제거/수정 필요한 파일:

| 파일 | 작업 |
|------|------|
| `src/services/error-handling/**/*` | 삭제 |
| `src/lib/service-registry.ts` | 수정 (import/등록 제거) |
| `src/lib/interfaces/services.ts` | 수정 (IErrorHandler 제거) |
| `src/lib/di-container.ts` | 수정 (토큰 제거) |

---

**작성 완료**: 2026-01-22
