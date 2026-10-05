import type {
  ArchitectureDiagram,
  ArchitectureDiagramView,
  DiagramLayer,
  DiagramNode,
} from '../architecture-diagrams.types';
import { dedupeConnectionLabels } from '../architecture-diagrams.utils';

const n = {
  user: {
    id: 'user',
    label: '사용자 질문',
    sublabel: 'AI 채팅 · 기능 탭',
    type: 'primary',
    icon: '💬',
  },
  vercelProxy: {
    id: 'vercel-proxy',
    label: 'Next.js 스트림 API',
    sublabel: 'supervisor stream v2',
    type: 'secondary',
    icon: '▲',
  },
  artifactIntent: {
    id: 'artifact-intent',
    label: 'Artifact Intent Gate',
    sublabel: 'regex + /api/ai/artifact-intent',
    type: 'highlight',
    icon: '▣',
  },
  artifactBff: {
    id: 'artifact-bff',
    label: 'Artifact BFF Routes',
    sublabel: 'incident · monitoring analysis',
    type: 'secondary',
    icon: '◇',
  },
  localArtifacts: {
    id: 'local-artifacts',
    label: 'Local Artifact Generators',
    sublabel: 'snapshot · ops procedure',
    type: 'secondary',
    icon: '⌘',
  },
  orchestrator: {
    id: 'orchestrator',
    label: 'Supervisor Router',
    sublabel: 'Direct Routing · Provider 순환',
    type: 'highlight',
    icon: '🧠',
  },
  monitoringBatch: {
    id: 'monitoring-batch',
    label: 'Monitoring Analyze Batch',
    sublabel: 'fact pack · queryFocusServer',
    type: 'secondary',
    icon: '📉',
  },
  nlq: {
    id: 'nlq',
    label: 'Metrics Query',
    sublabel: '상태 · 순위 · 시계열 조회',
    type: 'secondary',
    icon: '📊',
  },
  analyst: {
    id: 'analyst',
    label: 'Analyst',
    sublabel: '이상 탐지 · 원인 분석',
    type: 'secondary',
    icon: '🔬',
  },
  reporter: {
    id: 'reporter',
    label: 'Reporter',
    sublabel: '장애 보고서 · 타임라인',
    type: 'secondary',
    icon: '📑',
  },
  advisor: {
    id: 'advisor',
    label: 'Advisor',
    sublabel: '런북 · 조치 명령 제안',
    type: 'secondary',
    icon: '💡',
  },
  vision: {
    id: 'vision',
    label: 'Vision',
    sublabel: 'Gemini Flash-Lite 전용',
    type: 'highlight',
    icon: '👁️',
  },
  deterministic: {
    id: 'deterministic',
    label: 'Fact Layer',
    sublabel: '결정론적 순위 · 메트릭 · fallback',
    type: 'highlight',
    icon: '✓',
  },
  providerGate: {
    id: 'provider-gate',
    label: 'Provider Policy',
    sublabel: 'capability · quota · fallback',
    type: 'secondary',
    icon: '⚙️',
  },
  groq: {
    id: 'rr-groq',
    label: 'Groq',
    sublabel: 'GPT-OSS 20B · Text Pool',
    type: 'tertiary',
    icon: '⚡',
  },
  mistral: {
    id: 'rr-mistral',
    label: 'Mistral',
    sublabel: 'Small · Text + Analysis',
    type: 'tertiary',
    icon: '🌊',
  },
  zai: {
    id: 'rr-zai',
    label: 'Z.AI',
    sublabel: 'GLM Flash · Text + Analysis',
    type: 'tertiary',
    icon: '✨',
  },
  cerebras: {
    id: 'rr-cerebras',
    label: 'Cerebras',
    sublabel: '짧은 분류 · gpt-oss-120b',
    type: 'tertiary',
    icon: '🔮',
  },
  knowledge: {
    id: 'knowledgelite',
    label: 'Knowledge Lite',
    sublabel: 'Postgres FTS + metadata boost',
    type: 'secondary',
    icon: '📚',
  },
  websearch: {
    id: 'websearch',
    label: 'Web Search',
    sublabel: '요청 기반 외부 검색',
    type: 'tertiary',
    icon: '🌐',
  },
  otel: {
    id: 'otel-data',
    label: 'OTel Data',
    sublabel: '18대 서버 메트릭·로그',
    type: 'tertiary',
    icon: '📈',
  },
  renderer: {
    id: 'artifact-renderer',
    label: 'Artifact Renderer',
    sublabel: 'Envelope · origin line · cards',
    type: 'secondary',
    icon: '▤',
  },
  replay: {
    id: 'artifact-replay',
    label: 'Artifact Replay',
    sublabel: 'Envelope + session store',
    type: 'secondary',
    icon: '↺',
  },
} as const satisfies Record<string, DiagramNode>;

function layer(
  title: string,
  color: string,
  nodes: DiagramNode[]
): DiagramLayer {
  return { title, color, nodes };
}

const QUESTION_VIEW: ArchitectureDiagramView = {
  id: 'question',
  label: '질문 경로',
  title: '질문 경로',
  description:
    '채팅 질문이 Next.js 스트림으로 Supervisor에 들어가 에이전트와 근거만 고릅니다. 응답 스트림과 Provider 선택은 다른 탭입니다.',
  layers: [
    layer('사용자 입력', 'from-blue-500 to-blue-600', [n.user]),
    layer('Vercel 프론트엔드', 'from-slate-600 to-slate-700', [n.vercelProxy]),
    layer('Cloud Run AI Engine', 'from-indigo-500 to-purple-600', [
      n.orchestrator,
      n.deterministic,
    ]),
    layer('전문 에이전트', 'from-purple-500 to-pink-500', [
      n.nlq,
      n.analyst,
      n.reporter,
      n.advisor,
      n.vision,
    ]),
    layer('근거', 'from-green-500 to-emerald-600', [
      n.knowledge,
      n.websearch,
      n.otel,
    ]),
  ],
  connections: dedupeConnectionLabels([
    { from: 'user', to: 'vercel-proxy', label: 'POST' },
    { from: 'vercel-proxy', to: 'orchestrator', label: '위임' },
    { from: 'orchestrator', to: 'nlq', label: '라우팅' },
    { from: 'orchestrator', to: 'analyst' },
    { from: 'orchestrator', to: 'reporter' },
    { from: 'orchestrator', to: 'advisor' },
    { from: 'orchestrator', to: 'vision' },
    { from: 'orchestrator', to: 'deterministic', label: '보정' },
    { from: 'nlq', to: 'otel-data', type: 'dashed' },
    { from: 'analyst', to: 'otel-data', type: 'dashed' },
    { from: 'advisor', to: 'knowledgelite', type: 'dashed' },
    { from: 'nlq', to: 'websearch', type: 'dashed' },
  ]),
};

const PROVIDER_VIEW: ArchitectureDiagramView = {
  id: 'providers',
  label: 'Provider',
  title: 'Provider 선택',
  description:
    'Provider Policy가 쿼터와 능력에 맞춰 텍스트·분석 pool을 고릅니다. Vision은 Gemini 전용이라 이 순환에 넣지 않습니다.',
  layers: [
    layer('Cloud Run AI Engine', 'from-indigo-500 to-purple-600', [
      n.orchestrator,
      n.providerGate,
    ]),
    layer('LLM Providers', 'from-violet-500 to-purple-600', [
      n.groq,
      n.mistral,
      n.zai,
      n.cerebras,
    ]),
  ],
  connections: dedupeConnectionLabels([
    { from: 'orchestrator', to: 'provider-gate', label: '선택' },
    { from: 'provider-gate', to: 'rr-groq', label: '순환', type: 'dashed' },
    { from: 'provider-gate', to: 'rr-mistral', type: 'dashed' },
    { from: 'provider-gate', to: 'rr-zai', type: 'dashed' },
    { from: 'provider-gate', to: 'rr-cerebras', type: 'dashed' },
  ]),
};

const ARTIFACT_VIEW: ArchitectureDiagramView = {
  id: 'artifact',
  label: 'Artifact',
  title: 'Artifact 경로',
  description:
    '기능 탭·의도 게이트가 장애 보고서·분석 카드를 만들고, 관측 데이터 근거와 함께 카드로 렌더링한 뒤 세션에 저장합니다.',
  layers: [
    layer('사용자 입력', 'from-blue-500 to-blue-600', [n.user]),
    layer('Artifact 게이트', 'from-slate-600 to-slate-700', [
      n.artifactIntent,
      n.artifactBff,
      n.localArtifacts,
    ]),
    layer('분석 배치', 'from-indigo-500 to-purple-600', [n.monitoringBatch]),
    layer('관측 데이터', 'from-green-500 to-emerald-600', [n.otel]),
    layer('렌더링과 재생', 'from-cyan-500 to-blue-600', [n.renderer, n.replay]),
  ],
  connections: [
    { from: 'user', to: 'artifact-intent', label: 'Artifact' },
    { from: 'artifact-intent', to: 'artifact-bff', label: 'BFF' },
    { from: 'artifact-intent', to: 'local-artifacts', label: 'local' },
    { from: 'artifact-bff', to: 'monitoring-batch', label: '분석' },
    { from: 'monitoring-batch', to: 'otel-data', type: 'dashed' },
    { from: 'monitoring-batch', to: 'artifact-renderer', label: 'origin' },
    { from: 'local-artifacts', to: 'artifact-renderer', label: '생성' },
    { from: 'artifact-renderer', to: 'artifact-replay', label: '저장' },
    { from: 'artifact-renderer', to: 'user', label: '카드' },
  ],
};

export const AI_ASSISTANT_ARCHITECTURE: ArchitectureDiagram = {
  id: 'ai-assistant',
  title: 'AI 어시스턴트 런타임',
  description:
    '질문 라우팅, Provider 선택, Artifact 카드를 한 장에 넣지 않고 탭으로 나눕니다. 각 장은 인접 레이어만 연결합니다.',
  layers: QUESTION_VIEW.layers,
  connections: QUESTION_VIEW.connections,
  views: [QUESTION_VIEW, PROVIDER_VIEW, ARTIFACT_VIEW],
};
