/**
 * 🔧 AccessibilityProvider - Vercel SSR 호환
 *
 * 베르셀 최적화:
 * - SSR/하이드레이션 안전성 보장
 * - Edge Runtime 호환
 * - 클라이언트 사이드 점진적 향상
 * - WCAG 2.1 완전 준수
 *
 * ⚠️ 중요: 베르셀 배포 안정성을 위해 하이드레이션 미스매치 방지
 */

'use client';

import type React from 'react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// 🚀 Vercel SSR 안전 타입 정의
interface AccessibilityState {
  // 키보드 네비게이션
  isKeyboardNavigating: boolean;
  focusedElement: string | null;
  tabIndex: number;

  // ARIA 상태
  announcements: string[];
  ariaLive: 'off' | 'polite' | 'assertive';

  // 접근성 설정
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';

  // 스크린 리더 지원
  screenReaderActive: boolean;

  // 베르셀 최적화: 하이드레이션 상태
  isHydrated: boolean;
  isClient: boolean;
}

interface AccessibilityActions {
  // 키보드 네비게이션
  setKeyboardNavigating: (navigating: boolean) => void;
  setFocusedElement: (elementId: string | null) => void;
  navigateNext: () => void;
  navigatePrevious: () => void;

  // ARIA 관리
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  clearAnnouncements: () => void;

  // 접근성 설정
  toggleReducedMotion: () => void;
  toggleHighContrast: () => void;
  setFontSize: (size: AccessibilityState['fontSize']) => void;

  // 포커스 관리
  focusElement: (elementId: string) => void;
  trapFocus: (containerId: string) => void;
  releaseFocus: () => void;
}

type AccessibilityContextType = AccessibilityState & AccessibilityActions;

// 🛡️ SSR 안전 기본값
const defaultState: AccessibilityState = {
  isKeyboardNavigating: false,
  focusedElement: null,
  tabIndex: 0,
  announcements: [],
  ariaLive: 'polite',
  reducedMotion: false,
  highContrast: false,
  fontSize: 'medium',
  screenReaderActive: false,
  isHydrated: false,
  isClient: false,
};

// Context 생성
const AccessibilityContext = createContext<AccessibilityContextType | null>(
  null
);

// 🚀 Vercel 최적화: SSR 안전 Hook
export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      'useAccessibility must be used within AccessibilityProvider'
    );
  }
  return context;
};

// 🛡️ 베르셀 배포 안전: Optional Hook (에러 없이 사용 가능)
export const useAccessibilityOptional = () => {
  const context = useContext(AccessibilityContext);
  return context;
};

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({
  children,
}) => {
  // 🚀 SSR 안전 상태 관리
  const [state, setState] = useState<AccessibilityState>(defaultState);
  const [isClient, setIsClient] = useState(false);
  const focusTrapRef = useRef<string | null>(null);
  const announcementTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // 🛡️ 베르셀 하이드레이션 안전성: 클라이언트 사이드 감지
  // ⚡ 깜빡임 방지: 단일 setState로 모든 클라이언트 상태 초기화
  useEffect(() => {
    // 브라우저 접근성 설정 감지 (클라이언트 사이드만)
    if (typeof window !== 'undefined') {
      const mediaReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      );
      const mediaHighContrast = window.matchMedia('(prefers-contrast: high)');

      // ⚡ 단일 setState로 모든 초기화 통합 (깜빡임 방지)
      setIsClient(true);
      setState((prev) => ({
        ...prev,
        isClient: true,
        isHydrated: true,
        reducedMotion: mediaReducedMotion.matches,
        highContrast: mediaHighContrast.matches,
      }));

      // 스크린 리더 감지 (휴리스틱)
      const detectScreenReader = () => {
        const hasScreenReader = !!(
          navigator.userAgent.includes('NVDA') ||
          navigator.userAgent.includes('JAWS') ||
          navigator.userAgent.includes('VoiceOver') ||
          window.speechSynthesis
        );
        setState((prev) => ({ ...prev, screenReaderActive: hasScreenReader }));
        return hasScreenReader; // Return value 추가
      };

      detectScreenReader();

      // 미디어 쿼리 변경 감지
      const handleReducedMotionChange = (e: MediaQueryListEvent) => {
        setState((prev) => ({ ...prev, reducedMotion: e.matches }));
      };

      const handleHighContrastChange = (e: MediaQueryListEvent) => {
        setState((prev) => ({ ...prev, highContrast: e.matches }));
      };

      mediaReducedMotion.addEventListener('change', handleReducedMotionChange);
      mediaHighContrast.addEventListener('change', handleHighContrastChange);

      return () => {
        mediaReducedMotion.removeEventListener(
          'change',
          handleReducedMotionChange
        );
        mediaHighContrast.removeEventListener(
          'change',
          handleHighContrastChange
        );
      };
    }

    // window가 undefined인 경우의 cleanup 함수
    return () => {};
  }, []);

  // 🔧 키보드 네비게이션 관리
  const setKeyboardNavigating = useCallback((navigating: boolean) => {
    setState((prev) => ({ ...prev, isKeyboardNavigating: navigating }));
  }, []);

  const setFocusedElement = useCallback((elementId: string | null) => {
    setState((prev) => ({ ...prev, focusedElement: elementId }));
  }, []);

  // 🚀 베르셀 클라이언트 사이드: 키보드 네비게이션
  const navigateNext = useCallback(() => {
    if (!isClient) return;

    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = state.tabIndex;
    const nextIndex = (currentIndex + 1) % focusableElements.length;

    const nextElement = focusableElements[nextIndex] as HTMLElement;
    if (nextElement) {
      nextElement.focus();
      setState((prev) => ({
        ...prev,
        tabIndex: nextIndex,
        focusedElement: nextElement.id || null,
      }));
    }
  }, [isClient, state.tabIndex]);

  const navigatePrevious = useCallback(() => {
    if (!isClient) return;

    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const currentIndex = state.tabIndex;
    const prevIndex =
      currentIndex === 0 ? focusableElements.length - 1 : currentIndex - 1;

    const prevElement = focusableElements[prevIndex] as HTMLElement;
    if (prevElement) {
      prevElement.focus();
      setState((prev) => ({
        ...prev,
        tabIndex: prevIndex,
        focusedElement: prevElement.id || null,
      }));
    }
  }, [isClient, state.tabIndex]);

  // 🔊 ARIA Live 영역 관리
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      setState((prev) => ({
        ...prev,
        announcements: [...prev.announcements, message],
        ariaLive: priority,
      }));

      // 자동 정리 (5초 후)
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }

      announcementTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          announcements: prev.announcements.filter((a) => a !== message),
        }));
      }, 5000);
    },
    []
  );

  const clearAnnouncements = useCallback(() => {
    setState((prev) => ({ ...prev, announcements: [] }));
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
  }, []);

  // ⚙️ 접근성 설정 관리
  const toggleReducedMotion = useCallback(() => {
    setState((prev) => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setState((prev) => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const setFontSize = useCallback((size: AccessibilityState['fontSize']) => {
    setState((prev) => ({ ...prev, fontSize: size }));
  }, []);

  // 🎯 포커스 관리
  const focusElement = useCallback(
    (elementId: string) => {
      if (!isClient) return;

      const element = document.getElementById(elementId);
      if (element) {
        element.focus();
        setFocusedElement(elementId);
      }
    },
    [isClient, setFocusedElement]
  );

  const releaseFocus = useCallback(() => {
    if (!isClient || !focusTrapRef.current) return;

    const container = document.getElementById(focusTrapRef.current);
    if (container) {
      (container as { __focusTrapCleanup?: () => void }).__focusTrapCleanup?.();
    }

    focusTrapRef.current = null;
  }, [isClient]);

  const trapFocus = useCallback(
    (containerId: string) => {
      if (!isClient) return;

      focusTrapRef.current = containerId;
      const container = document.getElementById(containerId);

      if (!container) return;

      const focusableElements = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return; // 안전 검사 추가

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }

        if (e.key === 'Escape') {
          releaseFocus();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      firstElement.focus();

      // 정리 함수 저장
      (container as { __focusTrapCleanup?: () => void }).__focusTrapCleanup =
        () => {
          document.removeEventListener('keydown', handleKeyDown);
        };
    },
    [isClient, releaseFocus]
  );

  // 🚀 전역 키보드 이벤트 처리 (클라이언트 사이드만)
  useEffect(() => {
    if (!isClient) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab 키 감지로 키보드 네비게이션 활성화
      if (e.key === 'Tab') {
        setKeyboardNavigating(true);
      }

      // Escape 키로 포커스 트랩 해제
      if (e.key === 'Escape' && focusTrapRef.current) {
        releaseFocus();
      }
    };

    const handleMouseDown = () => {
      setKeyboardNavigating(false);
    };

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.id) {
        setFocusedElement(target.id);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isClient, setKeyboardNavigating, setFocusedElement, releaseFocus]);

  // 정리
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  const value: AccessibilityContextType = {
    ...state,
    setKeyboardNavigating,
    setFocusedElement,
    navigateNext,
    navigatePrevious,
    announce,
    clearAnnouncements,
    toggleReducedMotion,
    toggleHighContrast,
    setFontSize,
    focusElement,
    trapFocus,
    releaseFocus,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      {/* 🔊 ARIA Live 영역 - 항상 렌더링 (깜빡임 방지, sr-only로 숨김) */}
      <div
        aria-live={state.ariaLive}
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {/* 클라이언트 사이드에서만 announcements 표시 */}
        {isClient &&
          state.announcements.map((announcement, index) => (
            <div key={`${announcement}-${index}`}>{announcement}</div>
          ))}
      </div>
    </AccessibilityContext.Provider>
  );
};

// 🎨 CSS 유틸리티 (접근성 스타일)
export const getAccessibilityClasses = (
  reducedMotion: boolean = false,
  highContrast: boolean = false,
  fontSize: AccessibilityState['fontSize'] = 'medium'
) => {
  return {
    motion: reducedMotion ? 'motion-reduce' : 'motion-safe',
    contrast: highContrast ? 'contrast-more' : 'contrast-normal',
    fontSize: {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
      xlarge: 'text-xl',
    }[fontSize],
    focusRing: 'focus:ring-4 focus:ring-blue-500/20 focus:outline-hidden',
    skipLink:
      'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded',
  };
};

export default AccessibilityProvider;
