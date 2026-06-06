# 보안 아키텍처

> 인증/권한/방어 계층을 정의한 보안 아키텍처 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-06-06
> Canonical: docs/reference/architecture/infrastructure/security.md
> Tags: security,architecture,zero-trust
>
> **프로젝트 버전**: v8.11.97 | **Updated**: 2026-05-05

## 현재 SSOT

이 문서는 보안 구조를 설명하는 reference입니다. 구현 세부를 확인할 때는 아래 파일을 먼저 봅니다.

| 영역 | 구현 기준 |
|---|---|
| Supabase browser client | `src/lib/supabase/client.ts` |
| Supabase server client | `src/lib/supabase/server.ts`, `src/utils/supabase/middleware.ts` |
| OAuth callback | `src/app/auth/callback/route.ts` |
| Guest PIN login | `src/app/api/auth/guest-login/route.ts` |
| Guest region block | `src/lib/auth/guest-region-policy.ts` |
| Login audit | `src/lib/auth/login-audit.ts`, `security_audit_logs` |
| API auth guard | `src/lib/auth/api-auth.ts` |
| Security headers/CSP | `next.config.mjs` |
| Supabase public surface hardening | `supabase/migrations/20260428101907_harden_supabase_rag_public_surface.sql` |

## Zero Trust + Defense in Depth

### 보안 설계 원칙
1. **Zero Trust**: 모든 요청 의심하고 검증
2. **최소 권한**: 필요한 최소한 권한만 부여
3. **지속적 검증**: 세션 중에도 재검증
4. **다층 방어**: 네트워크/앱/데이터 계층 보호

### 인증 시스템 (Supabase Auth)
```typescript
// Supabase Auth 초기화
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 세션 관리
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// 안전한 로그아웃
export async function signOut() {
  try {
    await supabase.auth.signOut();
    // 쿠키 정리
    document.cookie = 'sb-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.href = '/login';
  } catch (error) {
    window.location.href = '/login'; // 강제 로그아웃
  }
}
```

### 로그인 방식 및 감사

- **소셜 로그인**: Google, GitHub OAuth를 통한 인증. `/auth/callback`에서 PKCE 코드 교환.
- **이메일 로그인**: Supabase OTP 기반 Magic Link. 사용자가 이메일을 입력하면 로그인 링크가 발송됨.
- **게스트 로그인**: PIN 검증 후 임시 세션 발급. `NEXT_PUBLIC_GUEST_FULL_ACCESS=false`일 때 4자리 PIN 필요.
- 로그인 이벤트(성공/실패/차단)는 `security_audit_logs` 테이블과 `SUPABASE_SERVICE_ROLE_KEY`가 구성된 환경에서 기록을 시도합니다. 테이블 또는 시크릿이 없으면 로그인 플로우는 유지하고 감사 기록만 skip합니다.
- 감사 로그 retention은 별도 `pg_cron`/Edge Function 없이 `recordLoginEvent` 성공 후 앱 레벨에서 수행합니다. 기준은 90일이며, 같은 프로세스에서는 24시간에 1회만 cleanup을 시도합니다.
- 게스트 로그인은 `/api/auth/guest-login`에서 국가 헤더(`x-vercel-ip-country`) 기반 차단 (`GUEST_LOGIN_BLOCKED_COUNTRIES`, 기본값: `CN`).
- 감사 로그는 서버에서 IP(`x-vercel-forwarded-for`, `x-forwarded-for`, `x-real-ip`)를 추출해 저장합니다.
- 보호 라우트의 `proxy`는 세션/게스트 여부만 확인하며, 지역 차단은 로그인 API에서만 적용합니다.
- Guest PIN brute-force 방어는 Upstash/Redis 기반 실패 카운트와 lock TTL을 사용하며, Redis 장애 시 로그인 흐름보다 fail-closed 여부를 우선 검토합니다.

### 데이터베이스 보안 (RLS)
```sql
-- 사용자별 데이터 격리
CREATE POLICY "user_isolation" ON user_sessions 
FOR ALL USING (auth.uid() = user_id);

-- API 키 암호화 저장
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API 보안
```typescript
// 레이트 리미팅
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 요청 제한
  message: { error: 'Too many requests' }
});

// 입력 검증
const validateInput = (schema: z.ZodSchema) => {
  return (req: NextRequest) => {
    try {
      schema.parse(req.body);
      return true;
    } catch (error) {
      throw new Error('Invalid input');
    }
  };
};
```

### 보안 헤더

실제 header 구성은 `next.config.mjs`가 기준입니다. 아래 예시는 필수 방어 계층을 설명하기 위한 축약형입니다.
```typescript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
};
```
