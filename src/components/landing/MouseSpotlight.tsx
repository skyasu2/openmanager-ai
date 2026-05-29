'use client';

import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 120;
const CONNECTION_DIST = 130;
const MOUSE_RADIUS = 200;
const REPEL_STRENGTH = 0.16;
const SPRING = 0.042;
const DAMPING = 0.88;

// AI concept 3 brand colors: violet / sky / pink
const BRAND_COLORS = [
  '167,139,250', // violet-400
  '125,211,252', // sky-300
  '244,114,182', // pink-400
] as const;

type BrandColor = (typeof BRAND_COLORS)[number];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  r: number;
  opacity: number;
  color: BrandColor;
}

function createParticle(width: number, height: number): Particle {
  const x = Math.random() * width;
  const y = Math.random() * height;
  const colorIndex = Math.floor(Math.random() * BRAND_COLORS.length);

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    homeX: x,
    homeY: y,
    r: Math.random() * 2.0 + 1.0,
    opacity: Math.random() * 0.38 + 0.2,
    color: BRAND_COLORS[colorIndex] ?? BRAND_COLORS[0],
  };
}

/** Mouse-repulsion particle field with colored constellation links. */
export function MouseSpotlight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let mouseX = -9999;
    let mouseY = -9999;
    let mouseActive = false;
    let particles: Particle[] = [];

    const init = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mouseX = -9999;
      mouseY = -9999;
      particles = Array.from({ length: PARTICLE_COUNT }, () =>
        createParticle(width, height)
      );
    };

    const onResize = () => {
      init();
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    };

    const onLeave = () => {
      mouseActive = false;
    };

    const tick = (now = performance.now()) => {
      ctx.clearRect(0, 0, width, height);

      const driftT = now * 0.00025;

      for (const p of particles) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (mouseActive && dist < MOUSE_RADIUS) {
          const t = 1 - dist / MOUSE_RADIUS;
          const force = t * t * REPEL_STRENGTH;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }

        // Idle drift gives each particle a slow independent orbit around home.
        p.vx += Math.sin(driftT + p.homeX * 0.009 + p.homeY * 0.003) * 0.06;
        p.vy +=
          Math.cos(driftT * 0.7 + p.homeY * 0.009 + p.homeX * 0.003) * 0.06;

        p.vx += (p.homeX - p.x) * SPRING;
        p.vy += (p.homeY - p.y) * SPRING;

        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
      }

      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < CONNECTION_DIST) {
            const alpha = (1 - d / CONNECTION_DIST) * 0.24;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${a.color},${alpha.toFixed(3)})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity.toFixed(3)})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    init();
    tick();

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="mouse-spotlight"
      className="mouse-spotlight"
    />
  );
}
