'use client';

import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 120;
const CONNECTION_DIST = 130;
const MOUSE_RADIUS = 200;
const MOUSE_STRENGTH = 0.14;
const SPRING = 0.055;
const DAMPING = 0.87;

// White is repeated intentionally so colored particles stay as accents.
const TINTS = [
  '255,255,255',
  '255,255,255',
  '255,255,255',
  '255,255,255',
  '255,255,255',
  '167,139,250',
  '125,211,252',
  '244,114,182',
] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  r: number;
  opacity: number;
  tint: string;
}

function createParticle(width: number, height: number): Particle {
  const x = Math.random() * width;
  const y = Math.random() * height;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    homeX: x,
    homeY: y,
    r: Math.random() * 1.8 + 0.5,
    opacity: Math.random() * 0.35 + 0.15,
    tint: TINTS[Math.floor(Math.random() * TINTS.length)] ?? TINTS[0],
  };
}

/** Mouse-directed particle field with soft constellation links. */
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
    let mouseX = 0;
    let mouseY = 0;
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
      mouseX = width / 2;
      mouseY = height * 0.42;
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

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (mouseActive && dist < MOUSE_RADIUS) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH;
          p.vx += (dx / dist) * force * dist * 0.012;
          p.vy += (dy / dist) * force * dist * 0.012;
        } else {
          p.vx += (p.homeX - p.x) * SPRING;
          p.vy += (p.homeY - p.y) * SPRING;
        }

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
            const alpha = (1 - d / CONNECTION_DIST) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.tint},${p.opacity.toFixed(3)})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    init();
    tick();

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
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
