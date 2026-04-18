/**
 * 🎯 자동 리사이즈 텍스트에어리어 컴포넌트
 *
 * 기능:
 * - 콘텐츠에 따라 자동 높이 조절
 * - 최소/최대 높이 제한
 * - 키보드 단축키 지원 (Ctrl+Enter)
 * - 접근성 완전 준수 (WCAG 2.1)
 */

'use client';

import {
  memo,
  type Ref,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';

interface AutoResizeTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  /** 최소 높이 (px) */
  minHeight?: number;
  /** 최대 높이 (px) */
  maxHeight?: number;
  /** viewport 기준 최대 높이 (vh) */
  maxHeightVh?: number;
  /** 키보드 단축키 핸들러 */
  onKeyboardShortcut?: (event: KeyboardEvent) => void;
  /** 값 변경 핸들러 */
  onValueChange?: (value: string) => void;
  /** ref */
  ref?: Ref<HTMLTextAreaElement>;
}

export const AutoResizeTextarea = memo(
  ({
    minHeight = 56,
    maxHeight = 300,
    maxHeightVh = 40,
    onKeyboardShortcut,
    onValueChange,
    className = '',
    style,
    onInput,
    onKeyDown,
    ref,
    value: controlledValue,
    ...props
  }: AutoResizeTextareaProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 외부 ref 동기화
    useEffect(() => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(textareaRef.current);
      } else {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          textareaRef.current;
      }
    }, [ref]);

    // 동적 높이 계산
    const calculateMaxHeight = useCallback(() => {
      const vhInPx = (maxHeightVh / 100) * window.innerHeight;
      return Math.min(maxHeight, vhInPx);
    }, [maxHeight, maxHeightVh]);

    // 자동 리사이즈 함수
    const autoResize = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const dynamicMaxHeight = calculateMaxHeight();

      // 높이를 일시적으로 auto로 설정하여 scrollHeight 정확히 측정
      textarea.style.height = 'auto';

      // 새로운 높이 계산 (패딩 고려)
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight + 2, dynamicMaxHeight) // +2px for border
      );

      textarea.style.height = `${newHeight}px`;

      // 스크롤이 필요한 경우 스크롤 표시
      textarea.style.overflowY =
        newHeight >= dynamicMaxHeight ? 'auto' : 'hidden';
    }, [minHeight, calculateMaxHeight]);

    // 입력 이벤트 핸들러
    const handleInput = useCallback(
      (event: React.InputEvent<HTMLTextAreaElement>) => {
        autoResize();
        onInput?.(event);
        onValueChange?.(event.currentTarget.value);
      },
      [autoResize, onInput, onValueChange]
    );

    // 키보드 이벤트 핸들러
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter: 전송 (onKeyboardShortcut 호출)
        // Shift+Enter: 줄바꿈 (기본 동작)
        // 조합키(한글 등) 입력 중에는 이벤트 무시 (isComposing)
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          onKeyboardShortcut?.(event.nativeEvent);
          return;
        }

        onKeyDown?.(event);
      },
      [onKeyboardShortcut, onKeyDown]
    );

    // 초기 및 resize 이벤트에 대한 자동 리사이즈
    useEffect(() => {
      autoResize();

      const handleResize = () => autoResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [autoResize]);

    // Controlled value가 바뀐 직후 높이를 다시 맞춰 flicker를 줄인다.
    useLayoutEffect(() => {
      if (controlledValue === undefined && !textareaRef.current) {
        return;
      }
      autoResize();
    }, [autoResize, controlledValue]);

    const dynamicMaxHeight = calculateMaxHeight();

    return (
      <textarea
        ref={textareaRef}
        className={`
          resize-none 
          transition-all duration-200 ease-out
          focus:outline-hidden
          touch-manipulation
          ${className}
        `.trim()}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${dynamicMaxHeight}px`,
          height: `${minHeight}px`,
          overflowY: 'hidden',
          fontSize: '16px', // iOS에서 확대 방지
          ...style,
        }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        aria-label={props['aria-label'] || '자동 크기 조절 텍스트 입력'}
        value={controlledValue}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
