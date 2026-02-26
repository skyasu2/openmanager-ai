# 개발 방법론 & 코딩 표준

> 프로젝트의 코드 스타일, 아키텍처 패턴, 개발 원칙 (typescript-rules.md 통합됨)
> Owner: engineering
> Status: Active
> Doc type: Standard
> Last reviewed: 2026-02-17
> Canonical: docs/development/coding-standards.md
> Tags: coding,standards,typescript

## 개요

이 문서는 `.claude/rules/`에 정의된 규칙들을 종합한 개발 가이드입니다.

---

## TypeScript 규칙

### Strict Mode 필수

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true
  }
}
```

### any 사용 금지

```typescript
// ❌ Bad
function process(data: any) { ... }

// ✅ Good
function process(data: ServerMetric) { ... }

// ✅ Good - 정말 모를 때는 unknown
function process(data: unknown) {
  if (isServerMetric(data)) { ... }
}
```

### unknown vs any 구분

- **any**: 절대 사용 금지 - 타입 안전성 완전 상실
- **unknown**: 타입을 알 수 없는 경우 사용 (타입 가드 필수)

```typescript
// ✅ unknown + 타입 가드
function processUnknown(data: unknown): string {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
  throw new Error('Invalid data type');
}

// ❌ any - 런타임 오류 가능성
function processAny(data: any): string {
  return data.toUpperCase();  // 컴파일은 통과하지만 위험
}
```

### 타입 정의

```typescript
// type alias 권장 (유연성)
type ServerStatus = 'healthy' | 'warning' | 'critical';

type ServerConfig = {
  id: string;
  name: string;
  status?: ServerStatus;  // optional은 기본값 필수
};

// 사용 시 기본값 지정
function createServer({ status = 'healthy' }: ServerConfig) { ... }
```

### Interface vs Type 선택 기준

| 상황 | 선택 | 이유 |
|------|------|------|
| Union / Intersection 필요 | `type` | `type Status = 'ok' \| 'error'` |
| 확장 가능한 객체 구조 | `interface` | `extends`로 상속 가능 |
| 함수 시그니처, 튜플 | `type` | 표현력 우수 |
| 라이브러리 공개 API | `interface` | Declaration Merging 지원 |

> 프로젝트 기본 권장: **type alias** (유니온, 인터섹션 유연성)

### Type-First 개발 패턴

타입 정의 -> 구현 -> 리팩토링 순서로 개발:

```typescript
// 1단계: 타입 정의
type AIQueryRequest = {
  query: string;
  mode: 'LOCAL' | 'GOOGLE_AI';
  context?: string;
};

type AIQueryResponse = {
  answer: string;
  confidence: number;
  sources: string[];
};

// 2단계: 타입에 맞춰 구현 (IDE 자동완성 지원)
async function queryAI(request: AIQueryRequest): Promise<AIQueryResponse> {
  return { answer: '...', confidence: 0.95, sources: ['...'] };
}

// 3단계: 타입 기반 안전한 리팩토링
function extractSources(response: AIQueryResponse): string[] {
  return response.sources;
}
```

### 타입 가드 활용

```typescript
// 커스텀 타입 가드 함수
function isServerData(data: unknown): data is ServerData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'status' in data
  );
}

// 사용 - 타입 가드 통과 후 안전한 접근
if (isServerData(response)) {
  console.log(response.name);  // 타입 안전
}
```

---

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `ServerCard.tsx` |
| 유틸리티 | camelCase | `formatDate.ts` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| 타입/인터페이스 | PascalCase (prefix 없음) | `ServerConfig` |
| Hook | use prefix | `useServerStatus` |
| 테스트 | `.test.ts` suffix | `ServerCard.test.tsx` |

---

## React & Next.js 패턴

### Server Components First

```typescript
// ✅ 기본값: Server Component
async function UserProfile({ id }: { id: string }) {
  const user = await fetchUser(id);  // 서버에서 직접 fetch
  return <div>{user.name}</div>;
}

// ✅ 필요할 때만 Client Component
'use client'
function LikeButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>Like</button>;
}
```

### 'use client' 최소화

클라이언트 컴포넌트가 필요한 경우:
- `useState`, `useEffect` 사용
- 이벤트 핸들러 (`onClick`, `onChange`)
- 브라우저 API (`window`, `localStorage`)

### useEffect 데이터 로딩 금지

```typescript
// ❌ Bad
useEffect(() => {
  fetch('/api/data').then(setData);
}, []);

// ✅ Good - Server Component
async function DataPage() {
  const data = await fetch('https://api.example.com/data');
  return <DataView data={data} />;
}

// ✅ Good - React Query
const { data } = useQuery(['data'], fetchData);
```

---

## Tailwind CSS 규칙

### Design Tokens 사용

```typescript
// ❌ Bad - 매직 넘버
<div className="w-[357px] h-[42px] bg-[#1a1a2e]">

// ✅ Good - 테마 토큰
<div className="w-96 h-10 bg-primary">
```

### cn() 유틸리티

```typescript
import { cn } from '@/lib/utils';

<button className={cn(
  "px-4 py-2 rounded",
  variant === 'primary' && "bg-blue-500 text-white",
  disabled && "opacity-50 cursor-not-allowed"
)} />
```

---

## 아키텍처 패턴

### 폴더 구조

```
src/
├── app/              # Next.js App Router
├── components/       # UI 컴포넌트 (feature별 하위 폴더)
├── hooks/            # Custom Hooks
├── services/         # 비즈니스 로직, API 클라이언트
├── stores/           # Zustand 상태 관리
├── types/            # TypeScript 타입 정의
└── lib/              # 유틸리티, 핵심 로직
```

### Single Source of Truth (SSOT)

```
서버 메트릭 데이터 소스:
public/data/otel-data/hourly/hour-XX.json (24개 파일)

Dashboard (Vercel)              Cloud Run AI
       ↓                              ↓
UnifiedServerDataSource         precomputed-state.ts
       ↓                              ↓
   MetricsProvider  ←─────────────────┘
```

### 하이브리드 아키텍처

```
Vercel (Frontend/BFF)          Cloud Run (AI Engine)
├── UI/Interactive             ├── Heavy Lifting
├── Edge Runtime               ├── Multi-Agent
└── Speed First                └── Vercel AI SDK
```

---

## 에러 처리

### 원칙

1. **Let It Crash** - 예상치 못한 에러는 최상위에서 처리
2. **Graceful Degradation** - AI 장애 시에도 UI 정상 동작
3. **Explicit Recovery** - try-catch는 복구 로직 있을 때만

### Catch Hell 금지

```typescript
// ❌ Bad - Catch Hell
try {
  await doSomething();
} catch (e) {
  console.log(e);
  throw e;  // 의미 없는 re-throw
}

// ✅ Good - 복구 가능할 때만
try {
  await fetchData();
} catch (e) {
  return fallbackData;  // 명확한 복구
}
```

---

## 테스트 원칙

### User-Centric Testing

```typescript
// ❌ Bad - 구현 상세 테스트
expect(component.state.isLoading).toBe(false);

// ✅ Good - 사용자 관점
expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

### Given-When-Then

```typescript
it('should show error for invalid email', async () => {
  // Given
  render(<LoginForm />);

  // When
  await userEvent.type(screen.getByLabelText('Email'), 'invalid');
  await userEvent.click(screen.getByRole('button', { name: 'Login' }));

  // Then
  expect(screen.getByText('Invalid email format')).toBeInTheDocument();
});
```

---

## Anti-Patterns

### 금지 사항

| Anti-Pattern | 설명 | 대안 |
|--------------|------|------|
| Catch Hell | 로그 후 re-throw | Global Error Boundary |
| YAGNI 위반 | 미래를 위한 추상화 | 필요할 때 추상화 |
| Over-Engineering | 과도한 레이어 | 단순하게 유지 |
| any 타입 | 타입 안전성 포기 | 명시적 타입 또는 unknown |

### Rule of Three

동일 로직이 **3번 이상** 반복될 때만 추상화:

```typescript
// ❌ 1-2회 반복에 과도한 추상화
const helper = createHelper(config);
helper.process(data);

// ✅ 3회 이상 반복 시 추상화
// formatDate가 10곳에서 사용 -> 유틸리티로 분리
```

---

## Vibe Coding 원칙

### AI는 수석 엔지니어 (Principal Engineer)

- 비개발자 1인 개발 체제이므로 AI가 아키텍처 설계, 보안 검증, 기술적 의사결정을 절대적으로 주도합니다.
- 단일 AI의 맹점을 피하기 위해 다중 AI 간 상호 교차 검증(Cross-validation)을 통해 품질과 보안을 보장합니다.
- AI 주도 하에 테스트 추가를 필수로 진행합니다.

### Strategic Decomposition

```
// ❌ Mega Prompt
"CRM 전체 만들어줘"

// ✅ Atomic Task
"OAuth2 미들웨어 구현해줘"
"사용자 로그인 API 만들어줘"
"세션 관리 훅 만들어줘"
```

### Spec Before Code

코드 생성 전 정의:
1. PRD (요구사항)
2. 데이터 모델
3. 보안 가드레일

### 기술 스택 활용 및 베스트 프랙티스 도입

- **상용 레퍼런스 비교 분석**: 새로운 기능이나 기술을 개발/적용할 때, 무작정 코드를 작성하지 않습니다. 현존하는 성공적인 상용 제품들의 베스트 프랙티스를 벤치마킹하고 비교 분석하여, 우리 프로젝트 성격에 맞게 최적화하여 도입합니다.
- **네이티브 기능 극대화 (Native-First)**: 외부 서드파티 라이브러리나 커스텀 래퍼(Wrapper)를 도입하기 전에, 현재 사용 중인 코어 기술(예: React 19의 최신 훅, Next.js의 고유 기능 등)이 제공하는 네이티브 API와 해결책을 최우선적으로 파악하고 극대화하여 활용합니다.

---

## 파일 크기 가이드라인

| 기준 | 조치 |
|------|------|
| ~500줄 | 정상 (권장 상한) |
| 500~800줄 | 경고, 분할 검토 |
| 800~1500줄 | 분할 필수 |
| 1500줄+ | 즉시 분리 |

---

## Import 순서

```typescript
// 1. React/Next.js
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. 외부 패키지
import { clsx } from 'clsx';
import { z } from 'zod';

// 3. 내부 모듈
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

// 4. 타입 (type-only import)
import type { ServerConfig } from '@/types';
```

---

## 관련 문서

- [개발 환경](./README.md)
- [프로젝트 설정](./project-setup.md)
- [Vibe Coding](./vibe-coding/README.md)
- [테스트 전략](../guides/testing/test-strategy.md)
