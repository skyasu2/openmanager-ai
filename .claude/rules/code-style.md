---
paths:
  - "src/**"
  - "cloud-run/**"
  - "tests/**"
  - "scripts/**"
  - "*.ts"
  - "*.tsx"
  - "*.js"
  - "*.jsx"
---

# Code Style Rules

## TypeScript Strict Mode
- `any` 사용 절대 금지
- `TypeScript strict` 모드 준수
- 명시적 타입 선언 권장

## Code Quality
- 중복 코드 지양
- 단일 책임 원칙(SRP) 준수
- 함수/클래스는 한 가지 역할만 수행
- 파일 길이: 500줄 이상 경고, 800줄 이상 분할 리팩토링

## Naming Conventions
- 컴포넌트: PascalCase (`ServerCard.tsx`)
- 유틸리티: camelCase (`formatDate.ts`)
- 상수: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- 타입/인터페이스: PascalCase, prefix 미사용 (`ServerConfig`, `MetricData`)
- Hook: `use` prefix (`useServerStatus`)

## Import & Formatting
- Biome 자동 포맷팅 적용
- Import 순서: React → 외부 패키지 → 내부 모듈 → 타입

---

## React & Next.js Guidelines (2025-2026)

### Server Components First
- **기본값은 Server Component**: 모든 컴포넌트는 Server Component로 시작
- **`'use client'` 최소화**: 상호작용(useState, useEffect), 브라우저 API, 이벤트 핸들러가 필요할 때만 전환
- **Streaming 활용**: `<Suspense>`와 `loading.tsx`로 점진적 렌더링

```typescript
// ✅ Good: Server Component (default)
async function UserProfile({ id }: { id: string }) {
  const user = await fetchUser(id); // 서버에서 직접 fetch
  return <div>{user.name}</div>;
}

// ✅ Good: Client Component (when needed)
'use client'
function LikeButton({ postId }: { postId: string }) {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>Like</button>;
}
```

### Data Fetching
- **`useEffect` 내 데이터 로딩 금지**: Server Component의 async/await 또는 React Query 사용
- **Server Actions 활용**: Form 제출, 데이터 변경에 Server Actions 우선

```typescript
// ❌ Bad: useEffect data fetching
useEffect(() => {
  fetch('/api/data').then(res => setData(res));
}, []);

// ✅ Good: Server Component
async function DataPage() {
  const data = await fetch('https://api.example.com/data');
  return <DataView data={data} />;
}

// ✅ Good: Server Action
'use server'
async function createPost(formData: FormData) {
  const post = await db.posts.create({ data: { ... } });
  revalidatePath('/posts');
}
```

### Props & Types
- **`type` alias 권장**: `interface` 대신 `type` 사용 (유니온, 인터섹션 유연성)
- **Optional Props Default 필수**: `?` 사용 시 반드시 기본값 지정

```typescript
// ✅ Good
type ButtonProps = {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
};

function Button({ variant = 'primary', size = 'md' }: ButtonProps) { ... }
```

---

## Styling (Tailwind CSS)

### Design Tokens
- **Arbitrary Values 지양**: `w-[357px]` 같은 매직 넘버 금지
- **테마 변수 우선**: `tailwind.config.ts`에 정의된 토큰 사용

```typescript
// ❌ Bad: Arbitrary value
<div className="w-[357px] h-[42px] bg-[#1a1a2e]">

// ✅ Good: Design tokens
<div className="w-96 h-10 bg-primary">
```

### Class Organization
- **Prettier Plugin 필수**: `prettier-plugin-tailwindcss`로 자동 정렬
- **순서**: Layout → Spacing → Typography → Color → Effects

```typescript
// ❌ Bad: Random order
className="text-white hover:bg-blue-600 p-4 flex bg-blue-500 rounded"

// ✅ Good: Organized (auto-sorted by Prettier)
className="flex rounded bg-blue-500 p-4 text-white hover:bg-blue-600"
```

### Conditional Styling
- **`cn()` 유틸리티 사용**: `clsx` + `tailwind-merge` 조합

```typescript
// ✅ Good: cn() utility
import { cn } from '@/lib/utils';

<button className={cn(
  "px-4 py-2 rounded",
  variant === 'primary' && "bg-blue-500 text-white",
  variant === 'secondary' && "bg-gray-200 text-gray-800",
  disabled && "opacity-50 cursor-not-allowed"
)} />
```

---

## Testing Style

### User-Centric Testing
- **내부 구현 테스트 금지**: state, internal 변수가 아닌 **사용자 관점(DOM)** 테스트
- **Testing Library 철학**: "The more your tests resemble the way your software is used, the more confidence they give you"

```typescript
// ❌ Bad: Implementation detail
expect(component.state.isLoading).toBe(false);

// ✅ Good: User-centric
expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

### Given-When-Then Structure
- **주석으로 구분**: 테스트 가독성 확보

```typescript
describe('LoginForm', () => {
  it('should show error message for invalid email', async () => {
    // Given: 로그인 폼 렌더링
    render(<LoginForm />);

    // When: 잘못된 이메일 입력 후 제출
    await userEvent.type(screen.getByLabelText('Email'), 'invalid');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    // Then: 에러 메시지 표시
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });
});
```

---

## Anti-Patterns (Strongly Discouraged)

### Catch Hell
- **단순 로그 후 re-throw 금지**: `try { ... } catch (e) { log(e); throw e; }`
- **이유**: 스택 추적 오염, 코드 가독성 저해
- **해결**: Global Error Boundary 위임 또는 복구 가능한 경우만 처리

### Abstraction Abuse (YAGNI)
- **구현체 1개뿐인 Interface 금지**
- **"미래를 위한" Base Class, Wrapper 금지**
- **Rule of Three**: 동일 로직 3번 이상 반복될 때만 추상화

### Over-Engineering
- **단순 CRUD에 복잡한 Layered Architecture 강제 금지**
- **Boilerplate > Business Logic 경계**

---

## Error Handling

### Principles
- **Let It Crash & Handle Globally**: 예상치 못한 에러는 최상위에서 처리
- **Graceful Degradation**: AI 엔진 장애 시에도 UI 정상 동작
- **Circuit Breaker**: 외부 API 호출 시 필수 적용
- **Explicit Recovery**: Local try-catch는 "복구 로직"이 명확할 때만 허용

### Recommended Stack
```
에러 발생 → Pino/Vercel Logs (로깅) → Global Error Boundary (UI)
```

---

## Vibe Coding Guidelines (2025-2026)

### AI 코드 리뷰 필수
- **AI 생성 코드 = Junior 개발자 코드**: 항상 검토, 테스트 필수
- **보안 검증**: AI 출력물은 untrusted로 취급 (45% 보안 취약점 포함 연구 결과)

### Strategic Decomposition
- **Mega Prompt 금지**: "CRM 만들어줘" ❌
- **Atomic Task**: "OAuth2 미들웨어 구현" ✅
- **Spec Before Code**: 코드 생성 전 PRD, 데이터 모델, 보안 가드레일 정의

### Modularity First
- **Eldritch Horror 방지**: 타이트한 커플링, 이해 불가능한 아키텍처 경계
- **Rapid Feedback Loop**: 작은 단위로 검증, 커밋, 테스트

---

## Infrastructure Code (비용 가드레일)

- 클라우드 리소스 설정 변경 시 Free Tier 한도 초과 여부 확인 필수
- `deploy.sh`, `cloudbuild.yaml`, `vercel.json` 수정 시 `.claude/rules/deployment.md`의 Free Tier 테이블 참조
- "최적화" 목적이라도 머신 타입, GPU, 고사양 인스턴스 추가 금지

---

_Last Updated: 2026-02-02 (Free Tier 가드레일 추가)_
