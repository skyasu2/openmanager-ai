'use client';

import { Check, Copy, RefreshCw } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';

interface MessageActionsProps {
  messageId: string;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'thinking';
  onRegenerate?: (messageId: string) => void;
  showRegenerate?: boolean;
  className?: string;
}

/**
 * 메시지 액션 버튼 컴포넌트
 * - 복사: 메시지 내용 클립보드 복사
 * - 재생성: AI 응답 재생성 (마지막 AI 응답에만)
 */
export const MessageActions = memo(function MessageActions({
  messageId,
  content,
  role,
  onRegenerate,
  showRegenerate = false,
  className = '',
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = setTimeout(() => {
        setCopied(false);
        copyResetTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      logger.error('Failed to copy:', error);
    }
  };

  const handleRegenerate = () => {
    onRegenerate?.(messageId);
  };

  const isAssistant = role === 'assistant';

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg bg-gray-50 px-1.5 py-0.5 ${className}`}
    >
      {/* 복사 버튼 */}
      <button
        type="button"
        onClick={handleCopy}
        className="flex min-h-6 min-w-6 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        title="메시지 복사"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-500">복사됨</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">복사</span>
          </>
        )}
      </button>

      {/* 재생성 버튼 (마지막 AI 응답에만) */}
      {isAssistant && showRegenerate && onRegenerate && (
        <>
          <div className="h-4 w-px bg-gray-200" />
          <button
            type="button"
            onClick={handleRegenerate}
            className="flex min-h-6 min-w-6 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            title="다시 생성"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">다시 생성</span>
          </button>
        </>
      )}
    </div>
  );
});
