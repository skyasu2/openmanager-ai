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
  { x: -320, y: -164, width: 4, height: 4, rotate: -18, depth: 0.74 },
  { x: -246, y: -228, width: 3, height: 3, rotate: 28, depth: -0.45 },
  { x: -148, y: -184, width: 5, height: 5, rotate: 14, depth: 0.58 },
  { x: -62, y: -262, width: 3, height: 3, rotate: -8, depth: 0.42 },
  { x: 74, y: -224, width: 4, height: 4, rotate: 19, depth: -0.5 },
  { x: 168, y: -176, width: 5, height: 5, rotate: 6, depth: 0.62 },
  { x: 286, y: -118, width: 4, height: 4, rotate: 42, depth: -0.68 },
  { x: 342, y: -24, width: 3, height: 3, rotate: -22, depth: 0.78 },
  { x: 252, y: 48, width: 5, height: 5, rotate: -26, depth: 0.5 },
  { x: 318, y: 142, width: 4, height: 4, rotate: 11, depth: -0.56 },
  { x: 186, y: 196, width: 3, height: 3, rotate: -34, depth: -0.48 },
  { x: 88, y: 276, width: 4, height: 4, rotate: 18, depth: 0.52 },
  { x: -28, y: 228, width: 5, height: 5, rotate: 24, depth: 0.66 },
  { x: -126, y: 292, width: 3, height: 3, rotate: -16, depth: -0.42 },
  { x: -226, y: 208, width: 4, height: 4, rotate: -38, depth: -0.4 },
  { x: -344, y: 112, width: 5, height: 5, rotate: 12, depth: 0.56 },
  { x: -284, y: 12, width: 3, height: 3, rotate: -4, depth: 0.72 },
  { x: -204, y: -42, width: 4, height: 4, rotate: 31, depth: -0.58 },
  { x: -98, y: 44, width: 3, height: 3, rotate: 7, depth: 0.44 },
  { x: 44, y: 92, width: 4, height: 4, rotate: -28, depth: -0.52 },
  { x: 132, y: 8, width: 3, height: 3, rotate: 15, depth: 0.7 },
  { x: 222, y: -72, width: 4, height: 4, rotate: -31, depth: -0.46 },
  { x: -14, y: -126, width: 5, height: 5, rotate: 34, depth: 0.48 },
  { x: 18, y: 166, width: 3, height: 3, rotate: -11, depth: -0.62 },
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
        const reactScale = 1 + intensity * (0.05 + exposedSide * 0.08);
        const fragmentOpacity = clamp(
          0.28 + intensity * 0.14 + exposedSide * 0.2,
          0.28,
          0.62
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
