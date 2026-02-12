# 🛡️ 보안 아키텍처

> **프로젝트 버전**: v8.0.0 | **Updated**: 2026-02-12

## 🛡️ Zero Trust + Defense in Depth

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
```typescript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'"
};
```
