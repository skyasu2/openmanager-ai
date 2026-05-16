/**
 * 🚫 게스트 제한 모달
 *
 * 게스트 모드에서 시스템 시작을 시도할 때 표시되는 안내 모달
 * 기존 alert() 대신 사용하여 UX 향상
 */

'use client';

import { AlertTriangle, CheckCircle2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AUTH_PROVIDER_COPY,
  LOGIN_POLICY_COPY,
} from '@/lib/auth/login-policy-copy';

interface GuestRestrictionModalProps {
  open: boolean;
  onClose: () => void;
  reason?: 'login-required' | 'guest-start-blocked';
}

const AUTHENTICATED_FEATURES = [
  '실시간 서버 모니터링',
  'AI 기반 분석 기능',
  '대시보드 전체 액세스',
] as const;

export function GuestRestrictionModal({
  open,
  onClose,
  reason = 'login-required',
}: GuestRestrictionModalProps) {
  const router = useRouter();

  const handleLoginRedirect = () => {
    onClose();
    router.push('/login');
  };

  const modalTitle =
    reason === 'guest-start-blocked' ? '게스트 모드 제한' : '로그인 필요';

  const description =
    reason === 'guest-start-blocked'
      ? LOGIN_POLICY_COPY.guestSystemStartBlocked
      : LOGIN_POLICY_COPY.systemStartGateDescription;

  const infoText =
    reason === 'guest-start-blocked'
      ? `게스트 세션이 제한된 환경에서는 ${AUTH_PROVIDER_COPY.listWithOr} 인증 계정으로 로그인해 주세요.`
      : LOGIN_POLICY_COPY.authPrompt;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="border-yellow-500/30 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 sm:max-w-md"
        data-testid="system-start-auth-modal"
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
            <AlertTriangle
              aria-hidden="true"
              className="h-6 w-6 text-yellow-500"
            />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            {modalTitle}
          </DialogTitle>
          <DialogDescription className="text-base text-slate-300">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm leading-relaxed text-slate-400">{infoText}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {AUTHENTICATED_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <CheckCircle2
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-green-400"
                />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white sm:w-auto"
          >
            나중에
          </Button>
          <Button
            onClick={handleLoginRedirect}
            className="w-full bg-linear-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 sm:w-auto"
          >
            <LogIn aria-hidden="true" className="mr-2 h-4 w-4" />
            로그인 페이지로 이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
