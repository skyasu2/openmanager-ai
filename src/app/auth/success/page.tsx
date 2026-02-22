/**
 * 🎉 OAuth 인증 성공 페이지 (레거시 호환 경량 라우트)
 *
 * 현재 권장 플로우는 /auth/callback에서 처리되며, 이 경로는
 * 과거 리다이렉트를 받은 경우를 위한 최소 호환 로직만 유지합니다.
 */

'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import debug from '@/utils/debug';

const DEFAULT_REDIRECT_PATH = '/main';

function sanitizeRedirectPath(path: string | null): string {
  if (!path) return DEFAULT_REDIRECT_PATH;
  if (!path.startsWith('/')) return DEFAULT_REDIRECT_PATH;
  if (path.startsWith('//')) return DEFAULT_REDIRECT_PATH;
  if (path.includes('\n') || path.includes('\r')) return DEFAULT_REDIRECT_PATH;
  return path;
}

function getTargetPath(): string {
  try {
    const stored = sessionStorage.getItem('auth_redirect_to');
    if (stored) {
      sessionStorage.removeItem('auth_redirect_to');
    }
    return sanitizeRedirectPath(stored);
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}

export default function AuthSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let isActive = true;

    const verifySessionAndRedirect = async () => {
      // 레거시 OAuth callback URL(/auth/success)로 들어온 경우
      // 서버 교환 엔드포인트(/auth/callback)로 즉시 위임한다.
      if (
        searchParams.has('code') ||
        searchParams.has('error') ||
        searchParams.has('error_description')
      ) {
        const query = searchParams.toString();
        const callbackUrl = query
          ? `/auth/callback?${query}`
          : '/auth/callback';
        router.replace(callbackUrl);
        return;
      }

      const targetPath = getTargetPath();

      try {
        const {
          data: { user },
          error,
        } = await getSupabase().auth.getUser();

        if (!isActive) return;

        if (error && error.message !== 'Auth session missing!') {
          debug.warn('⚠️ auth/success 사용자 검증 경고:', error.message);
        }

        if (!user) {
          router.replace('/login?error=no_user');
          return;
        }

        router.replace(targetPath);
      } catch (error) {
        debug.error('❌ auth/success 세션 확인 실패:', error);
        if (isActive) {
          router.replace('/login?error=session_check_failed');
        }
      }
    };

    void verifySessionAndRedirect();

    return () => {
      isActive = false;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-900 via-gray-800 to-black">
      <div className="text-center">
        <Loader2 className="mx-auto mb-6 h-12 w-12 animate-spin text-blue-500" />
        <h1 className="mb-2 text-2xl font-bold text-white">인증 확인 중...</h1>
        <p className="text-gray-400">잠시만 기다려주세요</p>
      </div>
    </div>
  );
}
