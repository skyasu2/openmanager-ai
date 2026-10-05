'use client';

import { useEffect, useRef } from 'react';

const DESKTOP_PARTICLE_COUNT = 120;
const TABLET_PARTICLE_COUNT = 72;
const MOBILE_PARTICLE_COUNT = 56;
const DESKTOP_CONNECTION_DIST = 100;
const TABLET_CONNECTION_DIST = 72;
const MOBILE_CONNECTION_DIST = 56;
const MOUSE_RADIUS = 200;
const MAX_REPEL_OFFSET = 52;
const IDLE_DRIFT_RADIUS = 3.2;
const PARTICLE_FIELD_HEIGHT_RATIO = 0.72;
const SPRING = 0.042;
const DAMPING = 0.88;
const FRAME_MS = 1000 / 60;
const RESIZE_DEBOUNCE_MS = 120;
const CONNECTION_ALPHA_BUCKETS = 4;

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

interface ParticleConfig {
  count: number;
  connectionDist: number;
  maxConnectionAlpha: number;
  avoidHeroCore: boolean;
  particleOpacityScale: number;
}

function resolveParticleConfig(width: number): ParticleConfig {
  if (width < 640) {
    return {
      count: MOBILE_PARTICLE_COUNT,
      connectionDist: MOBILE_CONNECTION_DIST,
      maxConnectionAlpha: 0.06,
      avoidHeroCore: true,
      particleOpacityScale: 0.82,
    };
  }

  if (width < 768) {
    return {
      count: TABLET_PARTICLE_COUNT,
      connectionDist: TABLET_CONNECTION_DIST,
      maxConnectionAlpha: 0.09,
      avoidHeroCore: true,
      particleOpacityScale: 0.9,
    };
  }

  return {
    count: DESKTOP_PARTICLE_COUNT,
    connectionDist: DESKTOP_CONNECTION_DIST,
    maxConnectionAlpha: 0.14,
    avoidHeroCore: false,
    particleOpacityScale: 1,
  };
}

function pickParticlePosition(
  width: number,
  height: number,
  avoidHeroCore: boolean
): { x: number; y: number } {
  if (!avoidHeroCore) {
    return {
      x: Math.random() * width,
      y: Math.random() * height * PARTICLE_FIELD_HEIGHT_RATIO,
    };
  }

  const x = Math.random() * width;
  const fieldHeight = height * PARTICLE_FIELD_HEIGHT_RATIO;
  const y = Math.random() * fieldHeight;
  const insideHeroCore =
    x > width * 0.18 &&
    x < width * 0.82 &&
    y > height * 0.18 &&
    y < height * 0.58;

  if (!insideHeroCore) {
    return { x, y };
  }

  const preferHorizontalEdge = Math.random() > 0.45;
  return preferHorizontalEdge
    ? {
        x:
          Math.random() > 0.5
            ? width * (0.82 + Math.random() * 0.18)
            : width * Math.random() * 0.18,
        y,
      }
    : {
        x,
        y:
          Math.random() > 0.5
            ? height *
              (0.58 + Math.random() * (PARTICLE_FIELD_HEIGHT_RATIO - 0.58))
            : height * Math.random() * 0.18,
      };
}

function createParticle(
  width: number,
  height: number,
  config: ParticleConfig
): Particle {
  const { x, y } = pickParticlePosition(width, height, config.avoidHeroCore);
  const colorIndex = Math.floor(Math.random() * BRAND_COLORS.length);

  return {
    x,
    y,
    vx: 0,
    vy: 0,
    homeX: x,
    homeY: y,
    r: Math.random() * 2.0 + 1.0,
    opacity: (Math.random() * 0.38 + 0.2) * config.particleOpacityScale,
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
    let config = resolveParticleConfig(window.innerWidth);
    let lastFrameTime = performance.now();
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const hasFinePointer = window.matchMedia(
      '(hover: hover) and (pointer: fine)'
    ).matches;

    const resizeCanvas = (nextWidth: number, nextHeight: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = nextWidth * dpr;
      canvas.height = nextHeight * dpr;
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      config = resolveParticleConfig(width);
      resizeCanvas(width, height);
      mouseX = -9999;
      mouseY = -9999;
      particles = Array.from({ length: config.count }, () =>
        createParticle(width, height, config)
      );
    };

    const remapParticles = (nextWidth: number, nextHeight: number) => {
      if (nextWidth === width && nextHeight === height) return;

      const widthRatio = width > 0 ? nextWidth / width : 1;
      const heightRatio = height > 0 ? nextHeight / height : 1;
      const nextConfig = resolveParticleConfig(nextWidth);

      particles = particles.slice(0, nextConfig.count).map((particle) => ({
        ...particle,
        x: particle.x * widthRatio,
        y: particle.y * heightRatio,
        homeX: particle.homeX * widthRatio,
        homeY: particle.homeY * heightRatio,
      }));

      while (particles.length < nextConfig.count) {
        particles.push(createParticle(nextWidth, nextHeight, nextConfig));
      }

      width = nextWidth;
      height = nextHeight;
      config = nextConfig;
      resizeCanvas(width, height);
      mouseX = -9999;
      mouseY = -9999;
      mouseActive = false;
    };

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        remapParticles(window.innerWidth, window.innerHeight);
      }, RESIZE_DEBOUNCE_MS);
    };

    const onMove = (event: PointerEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      mouseActive = true;
    };

    const onLeave = () => {
      mouseActive = false;
      mouseX = -9999;
      mouseY = -9999;
    };

    const tick = (now = performance.now()) => {
      const frameScale = Math.min(
        2,
        Math.max(0.5, (now - lastFrameTime) / FRAME_MS)
      );
      lastFrameTime = now;
      const damping = DAMPING ** frameScale;

      ctx.clearRect(0, 0, width, height);

      const driftT = now * 0.00025;

      for (const particle of particles) {
        const driftX =
          Math.sin(driftT + particle.homeX * 0.009 + particle.homeY * 0.003) *
          IDLE_DRIFT_RADIUS;
        const driftY =
          Math.cos(
            driftT * 0.7 + particle.homeY * 0.009 + particle.homeX * 0.003
          ) * IDLE_DRIFT_RADIUS;
        let targetX = particle.homeX + driftX;
        let targetY = particle.homeY + driftY;

        if (hasFinePointer && mouseActive) {
          const dx = mouseX - particle.x;
          const dy = mouseY - particle.y;
          const distance = Math.hypot(dx, dy) || 1;

          if (distance < MOUSE_RADIUS) {
            const proximity = 1 - distance / MOUSE_RADIUS;
            const repelOffset = proximity * proximity * MAX_REPEL_OFFSET;
            targetX -= (dx / distance) * repelOffset;
            targetY -= (dy / distance) * repelOffset;
          }
        }

        particle.vx += (targetX - particle.x) * SPRING * frameScale;
        particle.vy += (targetY - particle.y) * SPRING * frameScale;
        particle.vx *= damping;
        particle.vy *= damping;
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;
      }

      const connectionBatches = BRAND_COLORS.map(() =>
        Array.from({ length: CONNECTION_ALPHA_BUCKETS }, () => [] as number[])
      );

      ctx.lineWidth = width < 640 ? 0.28 : 0.38;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance >= config.connectionDist) continue;

          const alphaRatio = 1 - distance / config.connectionDist;
          const alphaBucket = Math.min(
            CONNECTION_ALPHA_BUCKETS - 1,
            Math.floor(alphaRatio * CONNECTION_ALPHA_BUCKETS)
          );
          const colorIndex = BRAND_COLORS.indexOf(a.color);
          connectionBatches[colorIndex]![alphaBucket]!.push(a.x, a.y, b.x, b.y);
        }
      }

      for (let colorIndex = 0; colorIndex < BRAND_COLORS.length; colorIndex++) {
        for (
          let alphaBucket = 0;
          alphaBucket < CONNECTION_ALPHA_BUCKETS;
          alphaBucket++
        ) {
          const segments = connectionBatches[colorIndex]![alphaBucket]!;
          if (segments.length === 0) continue;

          const alpha =
            ((alphaBucket + 0.5) / CONNECTION_ALPHA_BUCKETS) *
            config.maxConnectionAlpha;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${BRAND_COLORS[colorIndex]},${alpha})`;
          for (let index = 0; index < segments.length; index += 4) {
            ctx.moveTo(segments[index]!, segments[index + 1]!);
            ctx.lineTo(segments[index + 2]!, segments[index + 3]!);
          }
          ctx.stroke();
        }
      }

      for (const particle of particles) {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color},${particle.opacity})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(tick);
    };

    init();
    tick();

    if (hasFinePointer) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave, {
        passive: true,
      });
    }
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      if (hasFinePointer) {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
      }
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
