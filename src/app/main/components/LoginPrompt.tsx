/**
 * 🔐 로그인 유도 컴포넌트
 *
 * 게스트 사용자가 시스템 시작 권한이 없을 때 표시
 */

'use client';

import { User } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoginPromptProps {
  isMounted: boolean;
  guestModeMessage?: string;
}

export function LoginPrompt({ isMounted, guestModeMessage }: LoginPromptProps) {
  const router = useRouter();

  return (
    <div className="text-center">
      <div className="mb-4 rounded-xl border border-blue-400/30 bg-blue-500/10 p-4 sm:p-6">
        {isMounted && <User className="mx-auto mb-3 h-12 w-12 text-blue-400" />}
        <h3 className="mb-2 text-lg font-semibold text-white">
          로그인 또는 게스트 테스트가 필요합니다
        </h3>
        <p className="mb-4 text-sm text-blue-100">
          시스템 운영 기능은 GitHub, Google, 이메일 인증 사용자와 게스트 테스트
          모드 사용자가 이용할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          로그인 페이지로 이동
        </button>
      </div>
      <p className="text-xs text-gray-400">
        {guestModeMessage || '게스트 로그인은 테스트/체험 용도로만 제공됩니다.'}
      </p>
    </div>
  );
}

export default LoginPrompt;
