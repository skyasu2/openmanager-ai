import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const CLOUD_PLATFORM_ARCHITECTURE: ArchitectureDiagram = {
  id: 'cloud-platform',
  title: 'Hybrid Cloud Architecture',
  description:
    'GitLab canonical → GitLab CI deploy gate. Vercel(Frontend) + Cloud Run(AI) + Supabase(DB/Auth) + Upstash(Cache) + request-driven Cloud Tasks.',
  layers: [
    {
      title: 'Delivery Pipeline',
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
      title: 'Compute Layer',
      color: 'from-slate-600 to-slate-700',
      nodes: [
        {
          id: 'vercel',
          label: 'Vercel',
          sublabel: 'Next.js 16.1 + Edge CDN',
          type: 'primary',
          icon: '▲',
        },
        {
          id: 'cloudrun',
          label: 'Cloud Run',
          sublabel: 'Node.js 24 + Hono + AI SDK',
          type: 'highlight',
          icon: '🚀',
        },
        {
          id: 'cloudtasks',
          label: 'Cloud Tasks',
          sublabel: 'Request-driven AI job dispatch',
          type: 'secondary',
          icon: '📬',
        },
      ],
    },
    {
      title: 'Data Layer',
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
          sublabel: 'Response Cache + Rate Limit',
          type: 'secondary',
          icon: '🔄', // Redis fast cycle
        },
      ],
    },
    {
      title: 'External AI Providers',
      color: 'from-purple-500 to-pink-500',
      nodes: [
        {
          id: 'groq',
          label: 'Groq',
          sublabel: 'NLQ primary · low latency',
          type: 'tertiary',
          icon: '⚡',
        },
        {
          id: 'mistral-provider',
          label: 'Mistral',
          sublabel: 'Small · 32K ctx',
          type: 'tertiary',
          icon: '🌊',
        },
        {
          id: 'cerebras',
          label: 'Cerebras',
          sublabel: 'gpt-oss-120b · 65K ctx',
          type: 'tertiary',
          icon: '🧠',
        },
        {
          id: 'zai-provider',
          label: 'Z.AI',
          sublabel: 'GLM Flash · 128K ctx',
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
    { from: 'vercel', to: 'supabase', label: 'Query' },
    { from: 'vercel', to: 'cloudrun', label: 'AI Proxy' },
    { from: 'cloudrun', to: 'cloudtasks', label: 'CreateTask' },
    { from: 'cloudtasks', to: 'cloudrun', label: 'Job POST' },
    { from: 'cloudrun', to: 'supabase', label: 'Knowledge Retrieval' },
    { from: 'vercel', to: 'upstash', label: 'Cache' },
    { from: 'cloudrun', to: 'upstash', label: 'Cache' },
    { from: 'cloudrun', to: 'groq', label: 'Round-Robin', type: 'dashed' },
    {
      from: 'cloudrun',
      to: 'mistral-provider',
      label: 'Round-Robin',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'zai-provider',
      label: 'Round-Robin',
      type: 'dashed',
    },
    { from: 'cloudrun', to: 'cerebras', label: 'Round-Robin', type: 'dashed' },
    {
      from: 'cloudrun',
      to: 'gemini-provider',
      label: 'Vision',
      type: 'dashed',
    },
  ],
};
