import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const TECH_STACK_ARCHITECTURE: ArchitectureDiagram = {
  id: 'tech-stack',
  title: '프론트엔드 기술 스택',
  description:
    '검증 도구가 앱 프레임워크를 지키고, Next.js가 상태와 React 화면을 아래로 연결하는 단방향 구조입니다.',
  layers: [
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
    {
      title: '앱 프레임워크',
      color: 'from-blue-500 to-indigo-600',
      nodes: [
        {
          id: 'nextjs',
          label: 'Next.js 16',
          sublabel: 'App Router + Server Actions',
          type: 'highlight',
          icon: '▲',
        },
        {
          id: 'typescript',
          label: 'TypeScript 6.0',
          sublabel: 'Strict Mode',
          type: 'primary',
          icon: '📘',
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
          icon: '📡',
        },
        {
          id: 'hooks',
          label: 'React 19 Hooks',
          sublabel: '컴포넌트 로컬 상태',
          type: 'tertiary',
          icon: '⚓',
        },
      ],
    },
    {
      title: '화면 표현',
      color: 'from-pink-500 to-rose-500',
      nodes: [
        {
          id: 'react',
          label: 'React 19',
          sublabel: '대시보드·AI는 Client',
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
  ],
  connections: [
    { from: 'biome', to: 'typescript', type: 'dashed' },
    { from: 'vitest', to: 'nextjs', label: '검증', type: 'dashed' },
    { from: 'playwright', to: 'nextjs', type: 'dashed' },
    { from: 'nextjs', to: 'react', label: 'Renders' },
    { from: 'zustand', to: 'react' },
    { from: 'tanstack', to: 'react' },
  ],
};
