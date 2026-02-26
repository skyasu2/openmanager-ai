/**
 * 🚫 게스트 제한 모달
 *
 * 게스트 모드에서 시스템 시작을 시도할 때 표시되는 안내 모달
 * 기존 alert() 대신 사용하여 UX 향상
 */

'use client';

import { AlertTriangle, Github } from 'lucide-react';
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

interface GuestRestrictionModalProps {
  open: boolean;
  onClose: () => void;
}

export function GuestRestrictionModal({
  open,
  onClose,
}: GuestRestrictionModalProps) {
  const router = useRouter();

  const handleLoginRedirect = () => {
    onClose();
    router.push('/login');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="border-yellow-500/30 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            게스트 모드 제한
          </DialogTitle>
          <DialogDescription className="text-base text-slate-300">
            게스트 모드에서는 시스템을 시작할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
          <p className="text-sm leading-relaxed text-slate-400">
            GitHub 계정으로 로그인해 주세요.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              실시간 서버 모니터링
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              AI 기반 분석 기능
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              대시보드 전체 액세스
            </li>
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
            <Github className="mr-2 h-4 w-4" />
            GitHub 로그인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
