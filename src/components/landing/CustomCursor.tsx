'use client';

import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let rafId = 0;
    let isHovering = false;

    const show = () => {
      if (!activeRef.current) {
        activeRef.current = true;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
      }
    };

    const onMove = (e: MouseEvent) => {
      show();
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px,${mouseY}px,0)`;
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element;
      const clickable = target.closest(
        'button,a,[role="button"],summary,[tabindex]:not([tabindex="-1"])'
      );
      if (clickable && !isHovering) {
        isHovering = true;
        ring.setAttribute('data-hover', '');
      } else if (!clickable && isHovering) {
        isHovering = false;
        ring.removeAttribute('data-hover');
      }
    };

    const onLeave = () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      activeRef.current = false;
    };

    const animate = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      ring.style.transform = `translate3d(${ringX}px,${ringY}px,0)`;
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="custom-cursor-dot"
        style={{ opacity: 0 }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="custom-cursor-ring"
        style={{ opacity: 0 }}
      />
    </>
  );
}
