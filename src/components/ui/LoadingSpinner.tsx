/**
 * 🎬 LoadingSpinner Component v2.1 - 호환성 개선
 *
 * 로딩 상태를 시각적으로 표현하는 스피너 컴포넌트
 * - 프론트엔드 구성 90% 유지
 * - 실제 시스템과의 호환성 문제 해결
 * - 자연스러운 애니메이션과 진행률 표시
 */

// React import 제거 - Next.js 15 자동 JSX Transform 사용
import type { FC } from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'accent' | 'white';
  progress?: number;
  showProgress?: boolean;
  message?: string;
  className?: string;
}

/**
 * 🎬 LoadingSpinner Component v2.1 - 호환성 개선
 *
 * 로딩 상태를 시각적으로 표현하는 스피너 컴포넌트
 * - 프론트엔드 구성 90% 유지
 * - 실제 시스템과의 호환성 문제 해결
 * - 자연스러운 애니메이션과 진행률 표시
 */
export const LoadingSpinner: FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  progress = 0,
  showProgress = false,
  message,
  className,
}) => {
  // 크기 설정
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  // 색상 설정
  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-gray-500',
    accent: 'text-purple-500',
    white: 'text-white',
  };

  // 진행률 기반 메시지 (기존 로직 유지)
  const getProgressMessage = () => {
    if (message) return message;

    if (progress >= 95) return '거의 완료!';
    if (progress >= 80) return '마무리 중...';
    if (progress >= 60) return '처리 중...';
    if (progress >= 30) return '로딩 중...';
    return '시작 중...';
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-y-2',
        className
      )}
    >
      {/* 스피너 */}
      <div className="relative">
        {/* 기본 스피너 */}
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-gray-300',
            sizeClasses[size],
            colorClasses[color]
          )}
          style={{
            borderTopColor: 'currentColor',
            animationDuration: progress >= 90 ? '0.5s' : '1s', // 90% 이후 빠른 회전
          }}
        />

        {/* 진행률 표시 (선택적) */}
        {showProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn('text-xs font-medium', colorClasses[color])}>
              {Math.round(progress)}%
            </span>
          </div>
        )}
      </div>

      {/* 메시지 */}
      {(message || showProgress) && (
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {getProgressMessage()}
          </p>
          {showProgress && (
            <div className="mt-1">
              <div className="h-1.5 w-32 rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    colorClasses[color].replace('text-', 'bg-')
                  )}
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    transitionDuration: progress >= 90 ? '200ms' : '300ms', // 90% 이후 빠른 전환
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 기본 로딩 스피너 (별칭)
export const Spinner = LoadingSpinner;

// 전체 화면 로딩 오버레이
export const LoadingOverlay: FC<{
  isVisible: boolean;
  progress?: number;
  message?: string;
}> = ({ isVisible, progress = 0, message }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
        <LoadingSpinner
          size="lg"
          color="primary"
          progress={progress}
          showProgress={true}
          message={message}
        />
      </div>
    </div>
  );
};

export default LoadingSpinner;
