import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const VIBE_CODING_ARCHITECTURE: ArchitectureDiagram = {
  id: 'vibe-coding',
  title: 'AI 개발 워크플로우와 배포 게이트',
  description:
    'WSL 기반 AI 개발 루프에서 로컬 훅, 선택적 Docker CI, GitLab validate/deploy, Vercel production, 공개 스냅샷 동기화까지 이어지는 실제 운영 흐름입니다.',
  layers: [
    {
      title: '로컬 개발 루프',
      color: 'from-yellow-500 to-amber-600',
      nodes: [
        {
          id: 'wsl',
          label: 'WSL2 Ubuntu 24.04',
          sublabel: '주 개발 실행 환경',
          type: 'highlight',
          icon: '🐧',
        },
        {
          id: 'ai-cli',
          label: 'AI CLI Agents',
          sublabel: 'Claude Code · Codex · Gemini',
          type: 'highlight',
          icon: '🤖',
        },
      ],
    },
    {
      title: '로컬 품질 게이트',
      color: 'from-emerald-500 to-teal-600',
      nodes: [
        {
          id: 'pre-commit',
          label: 'Pre-commit Hook',
          sublabel: 'Biome format + lint',
          type: 'primary',
          icon: '🪝',
        },
        {
          id: 'pre-push',
          label: 'Pre-push Hook',
          sublabel: '관련 테스트 + 변경 TS 범위',
          type: 'highlight',
          icon: '🛫',
        },
        {
          id: 'local-ci',
          label: 'ci:local',
          sublabel: 'broad/release 변경 시',
          type: 'primary',
          icon: '🐋',
        },
      ],
    },
    {
      title: 'GitLab CI',
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
      title: '배포와 공개 스냅샷',
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
    { from: 'wsl', to: 'ai-cli', label: '작업' },
    { from: 'ai-cli', to: 'pre-commit', label: 'commit' },
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
