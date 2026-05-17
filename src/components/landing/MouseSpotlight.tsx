'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';

type SpotlightStyle = CSSProperties & {
  '--anchor-x': string;
  '--anchor-y': string;
};

const INITIAL_SPOTLIGHT_STYLE: SpotlightStyle = {
  '--anchor-x': '50vw',
  '--anchor-y': '42vh',
};

const ANCHOR_SELECTOR = '[data-spotlight-anchor="system-start"]';

const SPOTLIGHT_FRAGMENTS = [
  { x: -170, y: -92, width: 46, height: 8, rotate: -18, depth: 0.75 },
  { x: -104, y: -142, width: 18, height: 18, rotate: 28, depth: -0.45 },
  { x: 92, y: -132, width: 58, height: 7, rotate: 14, depth: 0.6 },
  { x: 166, y: -46, width: 22, height: 22, rotate: 42, depth: -0.7 },
  { x: 128, y: 80, width: 44, height: 8, rotate: -26, depth: 0.5 },
  { x: 34, y: 138, width: 16, height: 16, rotate: 18, depth: -0.55 },
  { x: -132, y: 104, width: 56, height: 7, rotate: 24, depth: 0.68 },
  { x: -198, y: 24, width: 20, height: 20, rotate: -38, depth: -0.4 },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * OpenManager 스타일 마우스 스포트라이트.
 * 시스템 시작 버튼을 기준점으로 삼고 주변 신호 조각만 마우스 방향에 반응시킨다.
 */
export function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = 0;
    const anchorPosition = {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.42,
    };

    const fragments = Array.from(
      el.querySelectorAll<HTMLElement>('.mouse-spotlight__fragment')
    );

    const updateAnchorPosition = () => {
      const anchor = document.querySelector<HTMLElement>(ANCHOR_SELECTOR);
      if (!anchor) {
        anchorPosition.x = window.innerWidth / 2;
        anchorPosition.y = window.innerHeight * 0.42;
      } else {
        const rect = anchor.getBoundingClientRect();
        anchorPosition.x = rect.left + rect.width / 2;
        anchorPosition.y = rect.top + rect.height / 2;
      }

      el.style.setProperty('--anchor-x', `${Math.round(anchorPosition.x)}px`);
      el.style.setProperty('--anchor-y', `${Math.round(anchorPosition.y)}px`);
    };

    const updateFragments = (clientX: number, clientY: number) => {
      const pullX = clamp((clientX - anchorPosition.x) * 0.045, -22, 22);
      const pullY = clamp((clientY - anchorPosition.y) * 0.045, -18, 18);

      fragments.forEach((fragment, index) => {
        const depth = SPOTLIGHT_FRAGMENTS[index]?.depth ?? 0.5;
        fragment.style.setProperty(
          '--react-x',
          `${(pullX * depth).toFixed(2)}px`
        );
        fragment.style.setProperty(
          '--react-y',
          `${(pullY * depth).toFixed(2)}px`
        );
      });
    };

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateFragments(e.clientX, e.clientY);
      });
    };

    updateAnchorPosition();
    updateFragments(anchorPosition.x, anchorPosition.y);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', updateAnchorPosition, { passive: true });
    window.addEventListener('scroll', updateAnchorPosition, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', updateAnchorPosition);
      window.removeEventListener('scroll', updateAnchorPosition);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="mouse-spotlight"
      data-testid="mouse-spotlight"
      style={INITIAL_SPOTLIGHT_STYLE}
    >
      {SPOTLIGHT_FRAGMENTS.map((fragment, index) => (
        <span
          key={`${fragment.x}-${fragment.y}`}
          className="mouse-spotlight__fragment"
          style={
            {
              '--fragment-x': `${fragment.x}px`,
              '--fragment-y': `${fragment.y}px`,
              '--fragment-w': `${fragment.width}px`,
              '--fragment-h': `${fragment.height}px`,
              '--fragment-rotate': `${fragment.rotate}deg`,
              '--fragment-delay': `${index * -0.34}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
