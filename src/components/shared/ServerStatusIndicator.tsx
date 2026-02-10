/**
 * 🟢 서버 상태 표시 컴포넌트
 *
 * 서버 상태에 따라 시각적 표시를 제공하는 공통 컴포넌트
 * - 일관된 UX 제공
 * - 퍼포먼스 최적화 (memo 사용)
 * - 접근성 지원
 * - 성능 추적 통합
 */

import type React from 'react';
import { memo } from 'react';
import type { ServerStatus } from '@/types/server';

interface ServerStatusIndicatorProps {
  status: ServerStatus;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

// 상태별 스타일 정의
const statusStyles = {
  online: {
    indicator: 'bg-emerald-500',
    pulse: 'animate-pulse-ring-emerald',
    text: 'text-emerald-700 bg-emerald-100',
  },
  warning: {
    indicator: 'bg-amber-500',
    pulse: 'animate-pulse-ring-amber',
    text: 'text-amber-700 bg-amber-100',
  },
  critical: {
    indicator: 'bg-red-500',
    pulse: 'animate-pulse-ring-red',
    text: 'text-red-700 bg-red-100',
  },
  offline: {
    indicator: 'bg-gray-400',
    pulse: '',
    text: 'text-gray-600 bg-gray-100',
  },
  maintenance: {
    indicator: 'bg-blue-500',
    pulse: 'animate-pulse-ring-blue',
    text: 'text-blue-700 bg-blue-100',
  },
  unknown: {
    indicator: 'bg-gray-500',
    pulse: '',
    text: 'text-gray-700 bg-gray-100',
  },
} as const;

export const ServerStatusIndicator: React.FC<ServerStatusIndicatorProps> = memo(
  ({ status, size = 'md', showText = true, className = '' }) => {
    const sizeClasses = {
      sm: 'w-2 h-2',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
    };

    const statusStyle = statusStyles[status];

    return (
      <output
        className={`inline-flex items-center gap-1.5 ${className}`}
        aria-label={`서버 상태: ${status}`}
      >
        <div
          className={`rounded-full ${statusStyle.indicator} ${sizeClasses[size]} ${statusStyle.pulse} transition-colors duration-300 ease-in-out`}
          aria-hidden="true"
        />
        {showText && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.text} transition-colors duration-300 ease-in-out`}
          >
            {status === 'online'
              ? '정상'
              : status === 'warning'
                ? '경고'
                : status === 'critical'
                  ? '심각'
                  : status === 'offline'
                    ? '오프라인'
                    : status === 'maintenance'
                      ? '점검 중'
                      : '알 수 없음'}
          </span>
        )}
      </output>
    );
  }
);

ServerStatusIndicator.displayName = 'ServerStatusIndicator';

export default ServerStatusIndicator;
