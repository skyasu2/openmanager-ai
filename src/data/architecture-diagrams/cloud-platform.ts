import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const CLOUD_PLATFORM_ARCHITECTURE: ArchitectureDiagram = {
  id: 'cloud-platform',
  title: '하이브리드 클라우드 실행 경계',
  description:
    'GitLab canonical 저장소와 CI 배포 게이트를 기준으로 Vercel 프론트엔드, Cloud Run AI Engine, Supabase, Upstash, Cloud Tasks를 분리 운영합니다.',
  layers: [
    {
      title: '배포 권한',
      color: 'from-orange-500 to-amber-600',
      nodes: [
        {
          id: 'gitlab',
          label: 'GitLab',
          sublabel: 'validate + semver tag deploy',
          type: 'highlight',
          icon: '🦊',
        },
      ],
    },
    {
      title: '컴퓨트 경계',
      color: 'from-slate-600 to-slate-700',
      nodes: [
        {
          id: 'vercel',
          label: 'Vercel',
          sublabel: 'Next.js App Router + CDN',
          type: 'primary',
          icon: '▲',
        },
        {
          id: 'cloudrun',
          label: 'Cloud Run AI Engine',
          sublabel: 'Node.js 24 + Hono + AI SDK',
          type: 'highlight',
          icon: '🚀',
        },
        {
          id: 'cloudtasks',
          label: 'Cloud Tasks',
          sublabel: '요청 기반 AI job dispatch',
          type: 'secondary',
          icon: '📬',
        },
      ],
    },
    {
      title: '데이터 경계',
      color: 'from-emerald-500 to-teal-600',
      nodes: [
        {
          id: 'supabase',
          label: 'Supabase',
          sublabel: 'PostgreSQL + Auth + RLS',
          type: 'primary',
          icon: '⚡', // Bolt (Supabase uses bolt often) or Generic DB 🗄️. Sticking with simple.
        },
        {
          id: 'upstash',
          label: 'Upstash Redis',
          sublabel: '응답 캐시 + Rate Limit',
          type: 'secondary',
          icon: '🔄', // Redis fast cycle
        },
      ],
    },
    {
      title: '외부 AI Provider',
      color: 'from-purple-500 to-pink-500',
      nodes: [
        {
          id: 'groq',
          label: 'Groq',
          sublabel: '텍스트 pool · 저지연',
          type: 'tertiary',
          icon: '⚡',
        },
        {
          id: 'mistral-provider',
          label: 'Mistral',
          sublabel: '텍스트 pool · Small',
          type: 'tertiary',
          icon: '🌊',
        },
        {
          id: 'cerebras',
          label: 'Cerebras',
          sublabel: '텍스트 pool · gpt-oss-120b',
          type: 'tertiary',
          icon: '🧠',
        },
        {
          id: 'zai-provider',
          label: 'Z.AI',
          sublabel: '텍스트 pool · GLM Flash',
          type: 'tertiary',
          icon: '✨',
        },
        {
          id: 'gemini-provider',
          label: 'Gemini',
          sublabel: 'Vision Agent · Flash-Lite',
          type: 'tertiary',
          icon: '👁️',
        },
      ],
    },
  ],
  connections: [
    { from: 'gitlab', to: 'vercel', label: 'CI Deploy' },
    { from: 'vercel', to: 'supabase', label: '조회' },
    { from: 'vercel', to: 'cloudrun', label: 'AI Proxy' },
    { from: 'cloudrun', to: 'cloudtasks', label: 'CreateTask' },
    { from: 'cloudtasks', to: 'cloudrun', label: 'Job POST' },
    { from: 'cloudrun', to: 'supabase', label: '지식 검색' },
    { from: 'vercel', to: 'upstash', label: '캐시' },
    { from: 'cloudrun', to: 'upstash', label: '캐시' },
    { from: 'cloudrun', to: 'groq', label: '순환', type: 'dashed' },
    {
      from: 'cloudrun',
      to: 'mistral-provider',
      label: '순환',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'zai-provider',
      label: '순환',
      type: 'dashed',
    },
    { from: 'cloudrun', to: 'cerebras', label: '순환', type: 'dashed' },
    {
      from: 'cloudrun',
      to: 'gemini-provider',
      label: 'Vision',
      type: 'dashed',
    },
  ],
};
