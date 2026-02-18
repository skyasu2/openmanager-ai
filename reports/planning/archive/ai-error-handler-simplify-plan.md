# AIErrorHandler 단순화 작업 계획서

**작성일**: 2026-01-22
**대상 파일**: `src/lib/ai/errors/AIErrorHandler.ts`
**현재 줄 수**: 421줄
**목표**: 50줄 이하

---

## 1. 현황 분석

### 1.1 파일 구조 (421줄)

```
AIErrorHandler.ts
├── [1-19] 문서 주석
├── [20-50] AIErrorType enum (17개 에러 타입)
├── [52-74] AIErrorDetails interface
├── [76-102] AIError class
├── [104-409] AIErrorHandler object
│   ├── toErrorMessage() - 에러 메시지 변환
│   ├── detectErrorType() - 에러 타입 감지 (100줄+)
│   ├── isRetryable() - 재시도 가능 여부
│   ├── getRetryDelay() - 재시도 지연 계산
│   ├── retryWithBackoff() - 지수 백오프 재시도
│   ├── createAIError() - AI 에러 생성
│   └── logError() - 에러 로깅
└── [411-421] retryAIOperation helper
```

### 1.2 사용처 분석

| 파일 | 사용 내용 |
|------|----------|
| `src/lib/ai/errors/AIErrorHandler.ts` | 자기 자신 |
| `src/config/ai-engine.ts` | import만 (실제 사용 없음) |

**결론**: 실제 사용처 **0곳** (import만 존재)

### 1.3 문제점

| 문제 | 설명 |
|------|------|
| 미사용 코드 | 421줄의 데드 코드 |
| 중복 기능 | Vercel AI SDK가 이미 retry 내장 |
| 과도한 에러 타입 | 17개 타입 중 실제 필요 5개 미만 |
| 복잡한 클래스 | 단순 함수로 대체 가능 |

---

## 2. Vercel AI SDK 대체 분석

### 2.1 AI SDK 내장 Retry 기능

```typescript
// Vercel AI SDK (2024-2025)
import { generateText } from 'ai';

const result = await generateText({
  model: mistral('mistral-small-latest'),
  prompt: 'Hello',
  // 내장 retry 옵션
  experimental_retry: {
    maxRetries: 3,
    retryOn: ['rate_limit', 'timeout', 'internal_server_error'],
  },
});
```

### 2.2 비교표

| 기능 | AIErrorHandler | Vercel AI SDK |
|------|:--------------:|:-------------:|
| Rate Limit Retry | ✅ | ✅ (내장) |
| Exponential Backoff | ✅ | ✅ (내장) |
| Error Classification | ✅ (17개) | ✅ (표준화) |
| Type Safety | ✅ | ✅ (더 좋음) |
| 유지보수 | 직접 | SDK 팀 |

---

## 3. 개선 방안

### Option A: 완전 제거 (권장)

**이유**:
- 실제 사용처 0곳
- Vercel AI SDK가 동일 기능 제공
- 421줄 데드 코드 제거

**작업**:
```bash
rm src/lib/ai/errors/AIErrorHandler.ts
```

**영향**:
- `src/config/ai-engine.ts`에서 import 제거 필요

### Option B: 최소 유지 (대안)

필요한 경우 간단한 유틸리티만 유지:

```typescript
// src/lib/ai/errors/index.ts (50줄 이하)

/**
 * AI 에러 타입 (최소화)
 */
export type AIErrorType =
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'unknown';

/**
 * 에러 타입 감지 (단순화)
 */
export function detectAIErrorType(error: unknown): AIErrorType {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

  if (message.includes('rate') || message.includes('429')) return 'rate_limit';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('network') || message.includes('fetch')) return 'network';
  if (message.includes('401') || message.includes('403')) return 'auth';
  return 'unknown';
}

/**
 * 재시도 가능 여부
 */
export function isRetryableError(type: AIErrorType): boolean {
  return ['rate_limit', 'timeout', 'network'].includes(type);
}
```

---

## 4. 선택된 방안: Option A (완전 제거)

### 4.1 이유

1. **사용처 0곳**: import만 존재, 실제 호출 없음
2. **Vercel AI SDK 대체**: 더 나은 retry 메커니즘 내장
3. **YAGNI 원칙**: 사용하지 않는 코드는 제거

### 4.2 작업 단계

#### Step 1: 사용처 확인
```bash
# 이미 확인됨: src/config/ai-engine.ts에서 import만 존재
grep -r "AIErrorHandler\|retryAIOperation" src/
```

#### Step 2: Import 제거
**파일**: `src/config/ai-engine.ts`
```diff
- import { AIErrorHandler } from '@/lib/ai/errors/AIErrorHandler';
```

#### Step 3: 파일 삭제
```bash
rm src/lib/ai/errors/AIErrorHandler.ts
```

#### Step 4: errors 디렉토리 확인
```bash
# 다른 파일이 있는지 확인
ls src/lib/ai/errors/
# 비어있으면 디렉토리도 삭제
rmdir src/lib/ai/errors/
```

---

## 5. 체크리스트

### 분석
- [x] 현재 파일 구조 분석 (421줄)
- [x] 사용처 분석 (0곳 실제 사용)
- [x] Vercel AI SDK 대체 가능 확인

### 실행
- [ ] `src/config/ai-engine.ts`에서 import 제거
- [ ] `src/lib/ai/errors/AIErrorHandler.ts` 삭제
- [ ] `src/lib/ai/errors/` 디렉토리 삭제 (비어있는 경우)

### 검증
- [ ] TypeScript 타입 검사 통과
- [ ] Biome lint 통과
- [ ] 빌드 성공
- [ ] AI 기능 정상 동작 확인

---

## 6. 예상 결과

| 항목 | Before | After |
|------|:------:|:-----:|
| 줄 수 | 421줄 | 0줄 |
| 파일 수 | 1개 | 0개 |
| 에러 타입 | 17개 | SDK 표준 |
| 유지보수 부담 | 높음 | 없음 |

---

## 7. 롤백 계획

문제 발생 시:
```bash
git revert HEAD
```

또는 Option B (최소 유지) 적용.

---

## 8. 향후 참고

AI 에러 처리가 필요한 경우 Vercel AI SDK의 내장 기능 사용:

```typescript
import { generateText } from 'ai';
import { mistral } from '@ai-sdk/mistral';

const result = await generateText({
  model: mistral('mistral-small-latest'),
  prompt: query,
  // SDK 내장 retry
  experimental_retry: {
    maxRetries: 3,
  },
});
```

---

**작성 완료**: 2026-01-22
