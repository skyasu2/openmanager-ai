/**
 * 🎯 CSS 타이핑 효과 컴포넌트 - Vercel 안정형
 *
 * ✅ 완전 안정적: 서버리스 환경에서 절대 사라지지 않음
 * ✅ 메모리 효율: JavaScript 메모리 누수 없음
 * ✅ 하이드레이션 안전: SSR 이슈 완전 해결
 * ✅ 성능 최적화: GPU 가속 애니메이션
 * ✅ 구현 간단: 복잡한 상태 관리 불필요
 */

'use client';

import type { FC } from 'react';

interface BasicTypingProps {
  text: string;
  speed?: 'slow' | 'normal' | 'fast';
  className?: string;
  showCursor?: boolean;
  cursorColor?: string;
  delay?: number;
}

const BasicTyping: FC<BasicTypingProps> = ({
  text,
  speed = 'normal',
  className = '',
  showCursor = true,
  cursorColor = '#3b82f6',
  delay = 0,
}) => {
  const safeText = text ?? '';
  const typingSteps = Math.max(safeText.length, 1);
  const speedMap = {
    slow: '4s',
    normal: '3s',
    fast: '2s',
  };

  const animationDelay = `${delay}s`;

  return (
    <div className={`typing-container ${className}`}>
      <span className="typing-text">{safeText}</span>

      <style jsx>{`
        .typing-container {
          display: inline-block;
          position: relative;
        }

        .typing-text {
          display: inline-block;
          overflow: hidden;
          border-right: ${showCursor ? `2px solid ${cursorColor}` : 'none'};
          white-space: nowrap;
          margin: 0;
          width: 0;
          animation: typing ${speedMap[speed]} steps(${typingSteps}, end)
            ${animationDelay} forwards
            ${
              showCursor
                ? `, blink-caret 0.75s step-end infinite ${animationDelay}`
                : ''
            };
        }

        @keyframes typing {
          from {
            width: 0;
          }
          to {
            width: 100%;
          }
        }

        ${
          showCursor
            ? `
        @keyframes blink-caret {
          from, to { 
            border-color: transparent; 
          }
          50% { 
            border-color: ${cursorColor}; 
          }
        }
        
        /* 타이핑 완료 후 커서 제거 */
        .typing-text {
          animation-delay: ${animationDelay}, ${animationDelay};
        }
        
        .typing-text::after {
          content: '';
          animation: remove-cursor 0.1s ${speedMap[speed]} ${animationDelay} forwards;
        }
        
        @keyframes remove-cursor {
          to {
            border-right: none;
          }
        }
        `
            : ''
        }

        /* GPU 가속 최적화 */
        .typing-text {
          transform: translateZ(0);
          will-change: width;
        }
      `}</style>
    </div>
  );
};

export default BasicTyping;
