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
  { x: -170, y: -92, width: 8, height: 8, rotate: -18, depth: 0.75 },
  { x: -104, y: -142, width: 6, height: 6, rotate: 28, depth: -0.45 },
  { x: 92, y: -132, width: 9, height: 9, rotate: 14, depth: 0.6 },
  { x: 166, y: -46, width: 7, height: 7, rotate: 42, depth: -0.7 },
  { x: 128, y: 80, width: 8, height: 8, rotate: -26, depth: 0.5 },
  { x: 34, y: 138, width: 6, height: 6, rotate: 18, depth: -0.55 },
  { x: -132, y: 104, width: 9, height: 9, rotate: 24, depth: 0.68 },
  { x: -198, y: 24, width: 7, height: 7, rotate: -38, depth: -0.4 },
  { x: -58, y: -188, width: 6, height: 6, rotate: -8, depth: 0.42 },
  { x: 218, y: 18, width: 10, height: 10, rotate: 6, depth: 0.82 },
  { x: 72, y: 188, width: 7, height: 7, rotate: -34, depth: -0.48 },
  { x: -238, y: -38, width: 8, height: 8, rotate: 12, depth: 0.58 },
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
      const deltaX = clientX - anchorPosition.x;
      const deltaY = clientY - anchorPosition.y;
      const cursorDistance = Math.hypot(deltaX, deltaY) || 1;
      const cursorUnitX = deltaX / cursorDistance;
      const cursorUnitY = deltaY / cursorDistance;
      const intensity = clamp(cursorDistance / 520, 0, 1);
      const pullX = clamp(deltaX * 0.075, -52, 52);
      const pullY = clamp(deltaY * 0.075, -42, 42);

      fragments.forEach((fragment, index) => {
        const config = SPOTLIGHT_FRAGMENTS[index];
        if (!config) return;

        const fragmentDistance = Math.hypot(config.x, config.y) || 1;
        const fragmentUnitX = config.x / fragmentDistance;
        const fragmentUnitY = config.y / fragmentDistance;
        const alignment =
          fragmentUnitX * cursorUnitX + fragmentUnitY * cursorUnitY;
        const exposedSide = (alignment + 1) / 2;
        const radialBoost = (exposedSide - 0.35) * intensity * 18;
        const depth = config.depth;
        const reactX = pullX * depth + fragmentUnitX * radialBoost;
        const reactY = pullY * depth + fragmentUnitY * radialBoost;
        const reactRotate = clamp(
          (pullX * 0.22 + pullY * 0.18) * depth + alignment * intensity * 12,
          -18,
          18
        );
        const reactScale = 1 + intensity * (0.08 + exposedSide * 0.12);
        const fragmentOpacity = clamp(
          0.27 + intensity * 0.18 + exposedSide * 0.16,
          0.24,
          0.72
        );

        fragment.style.setProperty('--react-x', `${reactX.toFixed(2)}px`);
        fragment.style.setProperty('--react-y', `${reactY.toFixed(2)}px`);
        fragment.style.setProperty(
          '--react-rotate',
          `${reactRotate.toFixed(2)}deg`
        );
        fragment.style.setProperty('--react-scale', reactScale.toFixed(3));
        fragment.style.setProperty(
          '--fragment-opacity',
          fragmentOpacity.toFixed(3)
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
