'use client';

import { useEffect, useRef } from 'react';

/**
 * Linear/Vercel 스타일 마우스 스포트라이트.
 *
 * 레퍼런스 기준:
 * - 반경 900px (넓을수록 중심 밀도 낮아져 자연스러움)
 * - 인디고 틴트 rgba(200,210,255,0.045) — 순수 흰색보다 덜 눈에 띄고
 *   wave-particles 보라/인디고 계열과 조화
 * - 45%에서 transparent — 가장자리 경계선 없는 자연스러운 페이드
 * - rAF 업데이트로 리플로우 없이 동작
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
          'radial-gradient(900px circle at var(--x, 50vw) var(--y, 40vh), rgba(200,210,255,0.045), transparent 45%)',
      }}
    />
  );
}
