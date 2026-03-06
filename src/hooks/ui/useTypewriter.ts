/**
 * 🎭 Typewriter Effect Hook
 *
 * AI 응답을 타이핑 효과로 표시하여 UX 개선
 * Cloud Run JSON 응답을 실시간 스트리밍처럼 보이게 함
 *
 * @created 2026-01-08 v5.85.0
 */

import { useEffect, useRef, useState } from 'react';

interface UseTypewriterOptions {
  /** 타이핑 속도 (ms per character) - 기본값: 15ms */
  speed?: number;
  /** 완료 후 콜백 */
  onComplete?: () => void;
  /** 타이핑 효과 활성화 여부 - 기본값: true */
  enabled?: boolean;
  /** 최소 지연 시간 (첫 글자 표시 전) - 기본값: 0 */
  initialDelay?: number;
}

interface UseTypewriterResult {
  /** 현재까지 표시된 텍스트 */
  displayedText: string;
  /** 타이핑 완료 여부 */
  isComplete: boolean;
  /** 타이핑 진행률 (0-100) */
  progress: number;
  /** 타이핑 즉시 완료 */
  complete: () => void;
  /** 타이핑 재시작 */
  restart: () => void;
}

/**
 * 타이핑 효과 훅
 *
 * @param text - 전체 텍스트
 * @param options - 타이핑 옵션
 * @returns 타이핑 상태 및 제어 함수
 *
 * @example
 * const { displayedText, isComplete } = useTypewriter(aiResponse, { speed: 20 });
 */
export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
): UseTypewriterResult {
  const { speed = 15, onComplete, enabled = true, initialDelay = 0 } = options;

  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(enabled);

  const textRef = useRef(text);
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 텍스트가 변경되면 애니메이션 재시작
  useEffect(() => {
    if (text !== textRef.current) {
      textRef.current = text;
      indexRef.current = 0;
      setDisplayedText('');
      setIsComplete(false);
      setShouldAnimate(enabled);
    }
  }, [text, enabled]);

  // 타이핑 애니메이션
  useEffect(() => {
    if (!shouldAnimate || !text) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    // 초기 지연
    const startTimeout = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (indexRef.current < text.length) {
          // 한 번에 1-3자씩 표시 (자연스러운 속도감)
          const charsToAdd = Math.min(
            Math.ceil(Math.random() * 2) + 1,
            text.length - indexRef.current
          );
          indexRef.current += charsToAdd;
          setDisplayedText(text.slice(0, indexRef.current));
        } else {
          // 완료
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);
    }, initialDelay);

    return () => {
      clearTimeout(startTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, speed, shouldAnimate, initialDelay, onComplete]);

  const complete = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    indexRef.current = text.length;
    setDisplayedText(text);
    setIsComplete(true);
    setShouldAnimate(false);
  };

  const restart = () => {
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
    setShouldAnimate(true);
  };

  const progress =
    text.length > 0
      ? Math.round((displayedText.length / text.length) * 100)
      : 100;

  return {
    displayedText,
    isComplete,
    progress,
    complete,
    restart,
  };
}

export default useTypewriter;
