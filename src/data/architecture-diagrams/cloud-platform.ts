import type {
  ArchitectureDiagram,
  ArchitectureDiagramView,
  DiagramLayer,
  DiagramNode,
} from '../architecture-diagrams.types';
import { dedupeConnectionLabels } from '../architecture-diagrams.utils';

const n = {
  gitlab: {
    id: 'gitlab',
    label: 'GitLab',
    sublabel: 'validate · semver tag deploy',
    type: 'highlight',
    icon: '🦊',
  },
  vercel: {
    id: 'vercel',
    label: 'Vercel',
    sublabel: 'Next.js App Router + CDN',
    type: 'primary',
    icon: '▲',
  },
  cloudrun: {
    id: 'cloudrun',
    label: 'Cloud Run Engine',
    sublabel: 'Node.js 24 + Hono + AI SDK',
    type: 'highlight',
    icon: '🚀',
  },
  cloudtasks: {
    id: 'cloudtasks',
    label: 'Cloud Tasks',
    sublabel: '요청 기반 AI job dispatch',
    type: 'secondary',
    icon: '📬',
  },
  supabase: {
    id: 'supabase',
    label: 'Supabase',
    sublabel: 'Auth · RLS · 지식 검색',
    type: 'primary',
    icon: '⚡',
  },
  upstash: {
    id: 'upstash',
    label: 'Upstash Redis',
    sublabel: 'Job 상태 · 쿼터 · AI 캐시',
    type: 'secondary',
    icon: '🔄',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    sublabel: '텍스트 pool · 저지연',
    type: 'tertiary',
    icon: '⚡',
  },
  mistral: {
    id: 'mistral-provider',
    label: 'Mistral',
    sublabel: '텍스트 pool · Small',
    type: 'tertiary',
    icon: '🌊',
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    sublabel: '분석 pool · gpt-oss-120b',
    type: 'tertiary',
    icon: '🧠',
  },
  zai: {
    id: 'zai-provider',
    label: 'Z.AI',
    sublabel: '텍스트 pool · GLM Flash',
    type: 'tertiary',
    icon: '✨',
  },
  gemini: {
    id: 'gemini-provider',
    label: 'Gemini',
    sublabel: 'Vision Agent · Flash-Lite',
    type: 'tertiary',
    icon: '👁️',
  },
} as const satisfies Record<string, DiagramNode>;

function layer(
  title: string,
  color: string,
  nodes: DiagramNode[]
): DiagramLayer {
  return { title, color, nodes };
}

const RUNTIME_VIEW: ArchitectureDiagramView = {
  id: 'runtime',
  label: '실행 경계',
  title: '하이브리드 실행 경계',
  description:
    'GitLab semver 태그가 Vercel과 Cloud Run을 배포하고, 데이터·쿼터 경계는 Supabase와 Upstash가 맡습니다. 외부 LLM은 Provider 탭에 있습니다.',
  layers: [
    layer('배포 권한', 'from-orange-500 to-amber-600', [n.gitlab]),
    layer('컴퓨트 경계', 'from-slate-600 to-slate-700', [
      n.vercel,
      n.cloudrun,
      n.cloudtasks,
    ]),
    layer('데이터 경계', 'from-emerald-500 to-teal-600', [
      n.supabase,
      n.upstash,
    ]),
  ],
  connections: [
    { from: 'gitlab', to: 'vercel', label: 'GitLab CI · semver tag' },
    { from: 'gitlab', to: 'cloudrun', label: 'GitLab CI · semver tag' },
    { from: 'vercel', to: 'cloudrun', label: 'HTTPS · SSE' },
    { from: 'cloudrun', to: 'cloudtasks', label: 'HTTPS · CreateTask' },
    { from: 'cloudtasks', to: 'cloudrun', label: 'HTTPS · Job POST' },
    { from: 'vercel', to: 'supabase', label: 'HTTPS · REST 조회' },
    { from: 'cloudrun', to: 'supabase', label: 'HTTPS · RPC 검색' },
    { from: 'vercel', to: 'upstash', label: 'HTTPS · REST 제한' },
    { from: 'cloudrun', to: 'upstash', label: 'HTTPS · REST 쿼터' },
  ],
};

const PROVIDER_VIEW: ArchitectureDiagramView = {
  id: 'providers',
  label: 'Provider',
  title: '외부 AI Provider',
  description:
    'Cloud Run이 텍스트·분석 pool을 순환하고, Vision만 Gemini로 보냅니다. 데이터 레이어를 관통하지 않도록 실행 경계와 데이터 경계를 나눴습니다.',
  layers: [
    layer('컴퓨트 경계', 'from-slate-600 to-slate-700', [n.cloudrun]),
    layer('외부 AI Provider', 'from-purple-500 to-pink-500', [
      n.groq,
      n.mistral,
      n.cerebras,
      n.zai,
      n.gemini,
    ]),
  ],
  connections: dedupeConnectionLabels([
    {
      from: 'cloudrun',
      to: 'groq',
      label: 'AI SDK · 텍스트 pool',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'mistral-provider',
      label: 'AI SDK · 텍스트 pool',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'zai-provider',
      label: 'AI SDK · 텍스트 pool',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'cerebras',
      label: 'AI SDK · 분석 pool',
      type: 'dashed',
    },
    {
      from: 'cloudrun',
      to: 'gemini-provider',
      label: 'AI SDK · Vision',
      type: 'dashed',
    },
  ]),
};

export const CLOUD_PLATFORM_ARCHITECTURE: ArchitectureDiagram = {
  id: 'cloud-platform',
  title: '하이브리드 클라우드 실행 경계',
  description:
    'GitLab canonical 저장소와 CI 배포 게이트를 기준으로 Vercel 프론트엔드, Cloud Run AI Engine, Supabase, Upstash, Cloud Tasks를 분리 운영합니다.',
  layers: RUNTIME_VIEW.layers,
  connections: RUNTIME_VIEW.connections,
  views: [RUNTIME_VIEW, PROVIDER_VIEW],
};
