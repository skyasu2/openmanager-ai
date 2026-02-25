'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

interface CollapsibleContentProps {
  children: React.ReactNode;
  maxHeight?: number;
  isStreaming?: boolean;
  isLastMessage?: boolean;
}

export const CollapsibleContent = memo(function CollapsibleContent({
  children,
  maxHeight = 400,
  isStreaming = false,
  isLastMessage = false,
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // ResizeObserver를 통해 콘텐츠의 높이 변화 감지
  useEffect(() => {
    // 스트리밍 중이거나 마지막 메시지인 경우 기본적으로 확장 상태 유지
    if (isStreaming || isLastMessage) {
      setIsExpanded(true);
      setNeedsCollapse(false);
      return;
    }

    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target.scrollHeight > maxHeight) {
          setNeedsCollapse(true);
        } else {
          setNeedsCollapse(false);
        }
      }
    });

    observer.observe(contentRef.current);

    // 초기 검사
    if (contentRef.current.scrollHeight > maxHeight) {
      setNeedsCollapse(true);
    }

    return () => observer.disconnect();
  }, [maxHeight, isStreaming, isLastMessage]);

  if (!needsCollapse || isStreaming || isLastMessage) {
    return <div ref={contentRef}>{children}</div>;
  }

  return (
    <div className="relative w-full">
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ${
          isExpanded ? 'max-h-none' : 'max-h-[400px]'
        }`}
        style={!isExpanded ? { maxHeight: `${maxHeight}px` } : undefined}
      >
        {children}
      </div>

      {!isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-linear-to-t from-white via-white/80 to-transparent pointer-events-none" />
      )}

      {needsCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>본문 접기</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>상세 본문 더보기</span>
            </>
          )}
        </button>
      )}
    </div>
  );
});
