'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';

type SpotlightStyle = CSSProperties & {
  '--x': string;
  '--y': string;
};

const INITIAL_SPOTLIGHT_STYLE: SpotlightStyle = {
  '--x': '50vw',
  '--y': '40vh',
};

/**
 * OpenManager 스타일 마우스 스포트라이트.
 * 운영 신호가 커서 주변으로 모이는 느낌만 남기고 실제 UI보다 뒤에 둔다.
 */
export function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId = 0;

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
      className="mouse-spotlight"
      data-testid="mouse-spotlight"
      style={INITIAL_SPOTLIGHT_STYLE}
    >
      <span className="mouse-spotlight__orbit mouse-spotlight__orbit--outer" />
      <span className="mouse-spotlight__orbit mouse-spotlight__orbit--inner" />
      <span className="mouse-spotlight__signal mouse-spotlight__signal--primary" />
      <span className="mouse-spotlight__signal mouse-spotlight__signal--metric" />
      <span className="mouse-spotlight__signal mouse-spotlight__signal--trace" />
    </div>
  );
}
