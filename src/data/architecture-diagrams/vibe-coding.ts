import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const VIBE_CODING_ARCHITECTURE: ArchitectureDiagram = {
  id: 'vibe-coding',
  title: 'Development Environment',
  description:
    'Google Antigravity IDE + WSL Terminal + Claude Code 중심의 Agentic Development 환경. AI가 만들고 AI가 검증.',
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
      title: 'MCP Servers (9개)',
      color: 'from-cyan-500 to-teal-600',
      nodes: [
        {
          id: 'context7',
          label: 'Context7',
          sublabel: 'Library Docs',
          type: 'secondary',
          icon: '📚',
        },
        {
          id: 'supabase-mcp',
          label: 'Supabase',
          sublabel: 'Database Access',
          type: 'secondary',
          icon: '⚡',
        },
        {
          id: 'vercel-mcp',
          label: 'Vercel',
          sublabel: 'Platform Access',
          type: 'secondary',
          icon: '▲',
        },
        {
          id: 'playwright-mcp',
          label: 'Playwright',
          sublabel: 'E2E Testing',
          type: 'tertiary',
          icon: '🎭',
        },
        {
          id: 'github-mcp',
          label: 'GitHub',
          sublabel: 'Repo Management',
          type: 'tertiary',
          icon: '🐙',
        },
        {
          id: 'next-devtools-mcp',
          label: 'Next DevTools',
          sublabel: 'Runtime Diagnostics',
          type: 'tertiary',
          icon: '🧭',
        },
        {
          id: 'seq-think',
          label: 'Sequential Thinking',
          sublabel: 'Complex Planning',
          type: 'tertiary',
          icon: '🔗', // Chain of thought
        },
        {
          id: 'stitch-mcp',
          label: 'Stitch',
          sublabel: 'Google UI Design',
          type: 'tertiary',
          icon: '🎨',
        },
        {
          id: 'storybook-mcp',
          label: 'Storybook',
          sublabel: 'Component Docs & Stories',
          type: 'tertiary',
          icon: '📖',
        },
      ],
    },
  ],
  connections: [
    { from: 'antigravity', to: 'claude-code', label: 'Terminal' },
    { from: 'claude-code', to: 'codex', label: '2-AI Review' },
    { from: 'claude-code', to: 'gemini', label: '2-AI Review' },
    // MCP Servers (9개)
    { from: 'claude-code', to: 'context7', label: 'MCP' },
    { from: 'claude-code', to: 'supabase-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'vercel-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'playwright-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'next-devtools-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'github-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'seq-think', label: 'MCP' },
    { from: 'claude-code', to: 'stitch-mcp', label: 'MCP' },
    { from: 'claude-code', to: 'storybook-mcp', label: 'MCP' },
  ],
};
