import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const VIBE_CODING_ARCHITECTURE: ArchitectureDiagram = {
  id: 'vibe-coding',
  title: 'Vibe Coding Split-Runner Delivery Flow',
  description:
    'Local WSL + AI-first build loop → pre-commit + pre-push gate → optional local Docker CI → GitLab CI validate (wsl2-docker self-hosted) → GitLab CI deploy (shared runner) → Vercel production → optional public snapshot sync.',
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
      title: 'Local Quality Gates',
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
          id: 'pre-push',
          label: 'Pre-push Hook',
          sublabel: 'related tests + changed TS scope',
          type: 'highlight',
          icon: '🛫',
        },
        {
          id: 'local-ci',
          label: 'Local Docker CI',
          sublabel: 'broad/release change only',
          type: 'primary',
          icon: '🐋',
        },
      ],
    },
    {
      title: 'GitLab CI Pipeline',
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
          id: 'gitlab-validate',
          label: 'Validate Job',
          sublabel: 'type-check + lint + test:quick',
          type: 'primary',
          icon: '✅',
        },
      ],
    },
    {
      title: 'Deploy & Public Sync',
      color: 'from-sky-500 to-indigo-600',
      nodes: [
        {
          id: 'gitlab-deploy',
          label: 'Deploy Job',
          sublabel: 'vercel build + vercel deploy --prod',
          type: 'highlight',
          icon: '🚀',
        },
        {
          id: 'vercel',
          label: 'Vercel Production',
          sublabel: 'CI deploy job 기준 production',
          type: 'primary',
          icon: '▲',
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
    { from: 'pre-commit', to: 'pre-push', label: 'local gate' },
    { from: 'pre-push', to: 'gitlab', label: 'quick pass' },
    {
      from: 'pre-push',
      to: 'local-ci',
      label: 'broad/release',
      type: 'dashed',
    },
    { from: 'local-ci', to: 'gitlab', label: 'full pass' },
    { from: 'gitlab', to: 'gitlab-validate', label: 'pipeline' },
    { from: 'gitlab-validate', to: 'gitlab-deploy', label: 'pass' },
    { from: 'gitlab-deploy', to: 'vercel', label: 'deploy' },
    { from: 'gitlab', to: 'github', label: 'sync:github', type: 'dashed' },
  ],
};
