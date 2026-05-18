/**
 * 🔐 로그인 유도 컴포넌트
 *
 * 게스트 사용자가 시스템 시작 권한이 없을 때 표시
 */

'use client';

import { User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LOGIN_POLICY_COPY } from '@/lib/auth/login-policy-copy';

interface LoginPromptProps {
  isMounted: boolean;
  guestModeMessage?: string;
}

export function LoginPrompt({ isMounted, guestModeMessage }: LoginPromptProps) {
  const router = useRouter();

  return (
    <div className="text-center">
      <div className="mb-4 rounded-xl border border-blue-400/40 bg-blue-500/15 p-4 shadow-lg shadow-blue-900/20 backdrop-blur-sm sm:p-6">
        {isMounted && (
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 ring-1 ring-blue-400/30">
            <User aria-hidden="true" className="h-7 w-7 text-blue-300" />
          </div>
        )}
        <h3 className="mb-2 text-lg font-semibold text-white">
          로그인 또는 게스트 테스트가 필요합니다
        </h3>
        <p className="mb-5 text-sm text-blue-100/90">
          {LOGIN_POLICY_COPY.landingCapabilities}
        </p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-linear-to-r from-blue-600 to-blue-700 px-6 font-semibold text-white shadow-lg shadow-blue-900/40 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-900/50"
        >
          로그인 페이지로 이동
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {guestModeMessage || '게스트 로그인은 테스트/체험 용도로만 제공됩니다.'}
      </p>
    </div>
  );
}
