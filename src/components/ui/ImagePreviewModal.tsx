'use client';

/**
 * ImagePreviewModal - 이미지 확대 미리보기 모달
 *
 * AI 채팅에서 첨부된 이미지 썸네일을 클릭하면 원본 크기로 확대 표시합니다.
 * ChatGPT/Claude Web과 동일한 UX 제공.
 *
 * @created 2026-01-28
 */

import { X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ImagePreviewModalProps = {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 이미지 URL (Base64 data URL 또는 일반 URL) */
  imageUrl: string;
  /** 이미지 파일명 (캡션으로 표시) */
  imageName: string;
};

/**
 * 이미지 확대 미리보기 모달
 *
 * @description
 * - ESC 키로 닫기 지원
 * - 외부 클릭으로 닫기 지원
 * - 접근성: aria-label, DialogTitle 포함
 */
export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  imageName,
}: ImagePreviewModalProps) {
  // ESC 키 핸들러 (Dialog에서 기본 제공하지만 명시적으로 추가)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        {/* 어두운 배경 오버레이 */}
        <DialogOverlay
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* 모달 콘텐츠 - 이미지 중앙 정렬 */}
        <div
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4',
            'pointer-events-none'
          )}
        >
          <div className="pointer-events-auto relative max-h-[90vh] max-w-[90vw]">
            {/* 접근성: 숨겨진 제목 */}
            <DialogTitle className="sr-only">
              이미지 미리보기: {imageName}
            </DialogTitle>

            {/* 닫기 버튼 (우상단) */}
            <DialogClose asChild>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'absolute -right-2 -top-10 z-10',
                  'flex h-8 w-8 items-center justify-center rounded-full',
                  'bg-white/10 text-white/80 backdrop-blur-sm',
                  'transition-colors hover:bg-white/20 hover:text-white',
                  'focus:outline-none focus:ring-2 focus:ring-white/50'
                )}
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogClose>

            {/* 이미지 */}
            <Image
              src={imageUrl}
              alt={imageName}
              width={1200}
              height={900}
              className={cn(
                'max-h-[80vh] w-auto rounded-lg object-contain',
                'shadow-2xl'
              )}
              unoptimized // Base64 data URLs은 최적화 불필요
              priority // 모달 열릴 때 즉시 로드
            />

            {/* 파일명 캡션 */}
            <p
              className={cn(
                'mt-3 text-center text-sm text-white/70',
                'truncate px-4'
              )}
            >
              {imageName}
            </p>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
