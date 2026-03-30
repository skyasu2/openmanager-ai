import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const VIBE_CODING_ARCHITECTURE: ArchitectureDiagram = {
  id: 'vibe-coding',
  title: 'Vibe Coding Delivery Flow',
  description:
    'Local WSL + AI-first build loop → pre-commit + Local Docker CI → GitLab canonical → Vercel production QA → public evidence export.',
  layers: [
    {
      title: 'Local Dev Loop',
      color: 'from-yellow-500 to-amber-600',
      nodes: [
        {
          id: 'antigravity',
          label: 'Google Antigravity',
          sublabel: 'WSL 터미널 호스트 IDE',
          type: 'highlight',
          icon: '🌌',
        },
        {
          id: 'claude-code',
          label: 'Claude Code',
          sublabel: 'AI-first 구현 루프',
          type: 'highlight',
          icon: '🤖',
        },
      ],
    },
    {
      title: 'Quality Gates',
      color: 'from-emerald-500 to-teal-600',
      nodes: [
        {
          id: 'pre-commit',
          label: 'Pre-commit Hook',
          sublabel: 'Biome format + lint gate',
          type: 'primary',
          icon: '🪝',
        },
        {
          id: 'local-ci',
          label: 'Local Docker CI',
          sublabel: 'type-check + test + smoke',
          type: 'highlight',
          icon: '🐋',
        },
      ],
    },
    {
      title: 'Canonical Delivery',
      color: 'from-orange-500 to-amber-600',
      nodes: [
        {
          id: 'gitlab',
          label: 'GitLab',
          sublabel: '정본 저장소, main push',
          type: 'highlight',
          icon: '🦊',
        },
        {
          id: 'vercel',
          label: 'Vercel Production',
          sublabel: 'GitLab main 기반 자동 배포',
          type: 'primary',
          icon: '▲',
        },
      ],
    },
    {
      title: 'Proof & Public Surface',
      color: 'from-sky-500 to-indigo-600',
      nodes: [
        {
          id: 'validation',
          label: 'Validation Evidence',
          sublabel: 'Playwright proof + latest proof run',
          type: 'highlight',
          icon: '🧪',
        },
        {
          id: 'public-snapshot',
          label: 'Public Snapshot JSON',
          sublabel: 'machine-readable QA evidence',
          type: 'primary',
          icon: '📄',
        },
        {
          id: 'github',
          label: 'GitHub Snapshot',
          sublabel: '선택적 공개 code export',
          type: 'tertiary',
          icon: '🐙',
        },
      ],
    },
  ],
  connections: [
    { from: 'antigravity', to: 'claude-code', label: 'WSL' },
    { from: 'claude-code', to: 'pre-commit', label: 'commit' },
    { from: 'pre-commit', to: 'local-ci', label: 'gate' },
    { from: 'local-ci', to: 'gitlab', label: 'pass' },
    { from: 'gitlab', to: 'vercel', label: 'auto deploy' },
    { from: 'vercel', to: 'validation', label: 'proof run' },
    { from: 'validation', to: 'public-snapshot', label: 'publish' },
    { from: 'gitlab', to: 'github', label: 'sync:github', type: 'dashed' },
  ],
};
