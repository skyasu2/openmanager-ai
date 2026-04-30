/**
 * 🔐 AI 로그인 필요 모달
 *
 * 비로그인 사용자가 AI 어시스턴트를 사용하려 할 때 표시
 * GitHub, Google, 이메일 로그인 안내
 */

'use client';

import { Bot, Github } from 'lucide-react';
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
import { AUTH_PROVIDER_COPY } from '@/lib/auth/login-policy-copy';

interface AILoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
}

export function AILoginRequiredModal({
  open,
  onClose,
}: AILoginRequiredModalProps) {
  const router = useRouter();

  const handleLoginRedirect = () => {
    onClose();
    router.push('/login');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="border-gray-200 bg-white text-gray-900 sm:max-w-md"
        data-testid="ai-login-required-modal-shell"
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 ring-1 ring-purple-100">
            <Bot className="h-6 w-6 text-purple-600" />
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            로그인이 필요합니다
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600">
            AI 어시스턴트 기능은 로그인 후 사용할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm leading-relaxed text-gray-600">
            <span className="font-medium text-gray-900">
              {AUTH_PROVIDER_COPY.listInline}
            </span>{' '}
            인증으로 로그인하여 다음 기능을 이용하세요:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-purple-600">•</span>
              AI 기반 서버 상태 분석
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-600">•</span>
              AI Chat
            </li>
            <li className="flex items-center gap-2">
              <span className="text-purple-600">•</span>
              실시간 모니터링 인사이트
            </li>
          </ul>
        </div>

        <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 sm:w-auto"
          >
            나중에
          </Button>
          <Button
            onClick={handleLoginRedirect}
            className="w-full bg-linear-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 sm:w-auto"
            data-testid="ai-login-redirect-button"
          >
            <Github className="mr-2 h-4 w-4" />
            로그인하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
