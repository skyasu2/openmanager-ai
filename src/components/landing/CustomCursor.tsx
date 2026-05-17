'use client';

import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    const show = () => {
      if (!activeRef.current) {
        activeRef.current = true;
        dot.style.opacity = '1';
      }
    };

    const onMove = (e: MouseEvent) => {
      show();
      dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
    };

    const onLeave = () => {
      dot.style.opacity = '0';
      activeRef.current = false;
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      aria-hidden="true"
      className="custom-cursor-dot"
      data-testid="custom-cursor-dot"
      style={{ opacity: 0 }}
    />
  );
}
