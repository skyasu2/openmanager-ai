import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const TECH_STACK_ARCHITECTURE: ArchitectureDiagram = {
  id: 'tech-stack',
  title: 'Frontend Architecture',
  description:
    'Next.js 16 + React 19 + TypeScript 5.9 기반 Next-Gen 프론트엔드 스택. 레이어별 기술 분리.',
  layers: [
    {
      title: 'Presentation Layer',
      color: 'from-pink-500 to-rose-500',
      nodes: [
        {
          id: 'react',
          label: 'React 19',
          sublabel: 'Server Components',
          type: 'primary',
          icon: '⚛️',
        },
        {
          id: 'tailwind',
          label: 'Tailwind CSS 4.1',
          sublabel: 'Oxides Engine',
          type: 'secondary',
          icon: '🎨',
        },
        {
          id: 'animate',
          label: 'Tailwind Animate',
          sublabel: 'CSS Animations',
          type: 'secondary',
          icon: '🎭', // Mask for animation/drama
        },
      ],
    },
    {
      title: 'State Layer',
      color: 'from-amber-500 to-orange-500',
      nodes: [
        {
          id: 'zustand',
          label: 'Zustand 5.0',
          sublabel: 'Global State',
          type: 'primary',
          icon: '🐻',
        },
        {
          id: 'tanstack',
          label: 'TanStack Query v5',
          sublabel: 'Server State',
          type: 'secondary',
          icon: '📡', // Satellite for remote data
        },
        {
          id: 'hooks',
          label: 'React 19 Hooks',
          sublabel: 'Local State',
          type: 'tertiary',
          icon: '⚓', // Hook
        },
      ],
    },
    {
      title: 'Framework Layer',
      color: 'from-blue-500 to-indigo-600',
      nodes: [
        {
          id: 'nextjs',
          label: 'Next.js 16',
          sublabel: 'App Router + PPR',
          type: 'highlight',
          icon: '▲',
        },
        {
          id: 'typescript',
          label: 'TypeScript 5.9',
          sublabel: 'Strict Mode',
          type: 'primary',
          icon: '📘', // Blue book for TS
        },
        {
          id: 'radix',
          label: 'Radix UI',
          sublabel: 'Accessible Primitives',
          type: 'secondary',
          icon: '🧩',
        },
      ],
    },
    {
      title: 'Build & Tools',
      color: 'from-gray-500 to-gray-600',
      nodes: [
        {
          id: 'biome',
          label: 'Biome',
          sublabel: 'Lint + Format',
          type: 'tertiary',
          icon: '🌿',
        },
        {
          id: 'vitest',
          label: 'Vitest',
          sublabel: 'Unit Tests',
          type: 'tertiary',
          icon: '🧪',
        },
        {
          id: 'playwright',
          label: 'Playwright',
          sublabel: 'E2E Tests',
          type: 'tertiary',
          icon: '🎭',
        },
      ],
    },
  ],
  connections: [
    // Framework → Presentation
    { from: 'nextjs', to: 'react', label: 'Renders' },
    { from: 'radix', to: 'react', label: 'Components' },
    { from: 'tailwind', to: 'react', label: 'Styles' },
    // State → Presentation
    { from: 'zustand', to: 'react', label: 'Global' },
    { from: 'hooks', to: 'react', label: 'Local' },
    // State → Framework
    { from: 'tanstack', to: 'nextjs', label: 'Server State' },
    // Framework internal
    { from: 'typescript', to: 'nextjs', label: 'Types' },
    // Build → Framework
    { from: 'biome', to: 'typescript', label: 'Lint' },
    { from: 'vitest', to: 'nextjs', label: 'Test' },
  ],
};
