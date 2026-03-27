import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const VIBE_CODING_ARCHITECTURE: ArchitectureDiagram = {
  id: 'vibe-coding',
  title: 'Development Workflow',
  description:
    'IDE, terminal, and connected services를 중심으로 유지되는 개인 개발 환경. 구현, 검증, 배포를 짧은 루프로 반복한다.',
  layers: [
    {
      title: 'IDE (Agent-First)',
      color: 'from-yellow-500 to-amber-600',
      nodes: [
        {
          id: 'antigravity',
          label: 'Google Antigravity',
          sublabel: 'Agent-first IDE (Google)',
          type: 'highlight',
          icon: '🪐', // Planet/Gravity
        },
      ],
    },
    {
      title: 'WSL Terminal (Main)',
      color: 'from-purple-500 to-indigo-600',
      nodes: [
        {
          id: 'claude-code',
          label: 'Claude Code',
          sublabel: 'Main Agent (v2.1+)',
          type: 'highlight',
          icon: '🤖',
        },
        {
          id: 'codex',
          label: 'Codex CLI',
          sublabel: '코드 구현 (수동 실행)',
          type: 'secondary',
          icon: '🔍',
        },
        {
          id: 'gemini',
          label: 'Gemini CLI',
          sublabel: '리서치/분석 (수동 실행)',
          type: 'secondary',
          icon: '💎',
        },
      ],
    },
    {
      title: 'Connected Services',
      color: 'from-cyan-500 to-teal-600',
      nodes: [
        {
          id: 'reference-docs',
          label: 'Reference Docs',
          sublabel: 'Technical Docs',
          type: 'secondary',
          icon: '📚',
        },
        {
          id: 'database',
          label: 'Supabase',
          sublabel: 'Data + Auth',
          type: 'secondary',
          icon: '⚡',
        },
        {
          id: 'deployment',
          label: 'Vercel',
          sublabel: 'Deployment',
          type: 'secondary',
          icon: '▲',
        },
        {
          id: 'repository',
          label: 'GitHub',
          sublabel: 'Repository',
          type: 'tertiary',
          icon: '🐙',
        },
        {
          id: 'runtime-diagnostics',
          label: 'Runtime Diagnostics',
          sublabel: 'App Health',
          type: 'tertiary',
          icon: '🧭',
        },
        {
          id: 'planning',
          label: 'Planning Tools',
          sublabel: 'Research + Reasoning',
          type: 'tertiary',
          icon: '🔗',
        },
        {
          id: 'design-workspace',
          label: 'Design Workspace',
          sublabel: 'UI Exploration',
          type: 'tertiary',
          icon: '🎨',
        },
      ],
    },
  ],
  connections: [
    { from: 'antigravity', to: 'claude-code', label: 'Terminal' },
    { from: 'claude-code', to: 'codex', label: 'Review' },
    { from: 'claude-code', to: 'gemini', label: 'Research' },
    { from: 'claude-code', to: 'reference-docs', label: 'Tooling' },
    { from: 'claude-code', to: 'database', label: 'Tooling' },
    { from: 'claude-code', to: 'deployment', label: 'Tooling' },
    { from: 'claude-code', to: 'repository', label: 'Tooling' },
    { from: 'claude-code', to: 'runtime-diagnostics', label: 'Tooling' },
    { from: 'claude-code', to: 'planning', label: 'Tooling' },
    { from: 'claude-code', to: 'design-workspace', label: 'Tooling' },
  ],
};
