'use client';

import { useEffect, useRef } from 'react';

/**
 * 마우스 커서를 따라 은은한 흰색 스포트라이트가 생기는 배경 효과.
 * CSS custom property(--x, --y)를 rAF로 업데이트해 리플로우 없이 동작.
 */
export function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId: number;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.style.setProperty('--x', `${e.clientX}px`);
        el.style.setProperty('--y', `${e.clientY}px`);
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[2]"
      style={{
        background:
          'radial-gradient(650px circle at var(--x, 50vw) var(--y, 40vh), rgba(255,255,255,0.06), transparent 38%)',
      }}
    />
  );
}
