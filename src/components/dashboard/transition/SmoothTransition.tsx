/**
 * 🌊 SmoothTransition Component v1.0
 *
 * 페이지 전환 래퍼 컴포넌트
 * - 깜빡임 방지
 * - 부드러운 페이지 전환
 * - 로딩 상태 관리
 */

import type { ReactNode } from 'react';
import { type FC, memo, useEffect, useState } from 'react';

interface SmoothTransitionProps {
  children: ReactNode;
  isLoading?: boolean;
  loadingComponent?: ReactNode;
  className?: string;
  onEnterComplete?: () => void;
  onExitComplete?: () => void;
}

const SmoothTransition: FC<SmoothTransitionProps> = memo(
  ({
    children,
    isLoading = false,
    loadingComponent,
    className = '',
    onEnterComplete,
    onExitComplete: _onExitComplete,
  }) => {
    const [_showContent, setShowContent] = useState(!isLoading);
    const [animationPhase, setAnimationPhase] = useState<
      'entering' | 'visible' | 'exiting'
    >('entering');

    useEffect(() => {
      if (isLoading) {
        setShowContent(false);
        setAnimationPhase('exiting');
        return;
      } else {
        setShowContent(true);
        setAnimationPhase('entering');

        // 애니메이션 완료 후 콜백 호출
        const timer = setTimeout(() => {
          setAnimationPhase('visible');
          onEnterComplete?.();
        }, 400);

        return () => clearTimeout(timer);
      }
    }, [isLoading, onEnterComplete]);

    // CSS 클래스 생성
    const getAnimationClass = () => {
      switch (animationPhase) {
        case 'entering':
          return 'animate-in fade-in slide-in-from-bottom-2 duration-400 ease-out';
        case 'exiting':
          return 'animate-out fade-out slide-out-to-top-2 duration-300 ease-in';
        default:
          return '';
      }
    };

    // 기본 로딩 컴포넌트
    const defaultLoadingComponent = (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500" />
          <p className="font-medium text-gray-600">
            페이지를 로드하고 있습니다...
          </p>
        </div>
      </div>
    );

    return (
      <div className={`relative ${className}`}>
        {isLoading ? (
          <div
            key="loading"
            className={`transition-all ${getAnimationClass()}`}
            style={{
              willChange: 'transform, opacity',
              transform: 'translate3d(0, 0, 0)',
            }}
          >
            {loadingComponent || defaultLoadingComponent}
          </div>
        ) : (
          <div
            key="content"
            className={`transition-all ${getAnimationClass()}`}
            style={{
              willChange: 'transform, opacity',
              transform: 'translate3d(0, 0, 0)',
            }}
          >
            <div className="duration-300 ease-out animate-in fade-in slide-in-from-bottom-1">
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SmoothTransition.displayName = 'SmoothTransition';

export default SmoothTransition;
