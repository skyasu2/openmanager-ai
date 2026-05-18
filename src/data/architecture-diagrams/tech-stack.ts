import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const TECH_STACK_ARCHITECTURE: ArchitectureDiagram = {
  id: 'tech-stack',
  title: '프론트엔드 기술 스택',
  description:
    'Next.js 16, React 19, TypeScript 6.0 기반 UI와 144 슬롯 시계열 차트, AI 스트리밍 화면을 레이어별로 분리한 구조입니다.',
  layers: [
    {
      title: '화면 표현',
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
          label: 'Tailwind CSS 4.2',
          sublabel: '유틸리티 기반 디자인',
          type: 'secondary',
          icon: '🎨',
        },
        {
          id: 'charts',
          label: 'Charts',
          sublabel: 'Nivo · SVG Sparkline · uPlot',
          type: 'secondary',
          icon: '📈',
        },
      ],
    },
    {
      title: '상태 관리',
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
          sublabel: '서버 상태 캐시',
          type: 'secondary',
          icon: '📡', // Satellite for remote data
        },
        {
          id: 'hooks',
          label: 'React 19 Hooks',
          sublabel: '컴포넌트 로컬 상태',
          type: 'tertiary',
          icon: '⚓', // Hook
        },
      ],
    },
    {
      title: '앱 프레임워크',
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
          label: 'TypeScript 6.0',
          sublabel: 'Strict Mode',
          type: 'primary',
          icon: '📘', // Blue book for TS
        },
        {
          id: 'radix',
          label: 'Radix UI',
          sublabel: '접근성 primitive',
          type: 'secondary',
          icon: '🧩',
        },
      ],
    },
    {
      title: '검증 도구',
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
          sublabel: 'unit · contract',
          type: 'tertiary',
          icon: '🧪',
        },
        {
          id: 'playwright',
          label: 'Playwright',
          sublabel: 'E2E · QA evidence',
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
    { from: 'charts', to: 'react', label: 'Render' },
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
    { from: 'playwright', to: 'nextjs', label: 'E2E Test' },
  ],
};
