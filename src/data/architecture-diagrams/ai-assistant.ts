import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const AI_ASSISTANT_ARCHITECTURE: ArchitectureDiagram = {
  id: 'ai-assistant',
  title: 'Multi-Agent Architecture (AI SDK v6)',
  description:
    'Vercel AI SDK v6 네이티브 ToolLoopAgent 기반 5-Agent 멀티 에이전트 + Evaluator-Optimizer 파이프라인. 4개 LLM 프로바이더 무료 한도 내 폴백 체인. GraphRAG + Tavily 하이브리드 검색.',
  layers: [
    {
      title: 'Client',
      color: 'from-blue-500 to-blue-600',
      nodes: [
        {
          id: 'user',
          label: 'User Query',
          sublabel: 'AI Chat Interface',
          type: 'primary',
          icon: '💬',
        },
      ],
    },
    {
      title: 'Vercel (Frontend)',
      color: 'from-slate-600 to-slate-700',
      nodes: [
        {
          id: 'vercel-proxy',
          label: 'Next.js API',
          sublabel: '/api/ai/supervisor',
          type: 'secondary',
          icon: '▲',
        },
      ],
    },
    {
      title: 'Google Cloud Run (AI Engine)',
      color: 'from-indigo-500 to-purple-600',
      nodes: [
        {
          id: 'orchestrator',
          label: 'Orchestrator',
          sublabel: 'Multi-Provider Routing',
          type: 'highlight',
          icon: '🧠',
        },
      ],
    },
    {
      title: 'Specialized Agents',
      color: 'from-purple-500 to-pink-500',
      nodes: [
        {
          id: 'nlq',
          label: 'NLQ Agent',
          sublabel: 'Cerebras gpt-oss-120b',
          type: 'secondary',
          icon: '🔍',
        },
        {
          id: 'analyst',
          label: 'Analyst Agent',
          sublabel: 'Anomaly & RCA',
          type: 'secondary',
          icon: '📊',
        },
        {
          id: 'reporter',
          label: 'Reporter Agent',
          sublabel: 'Groq + Eval-Opt Pipeline',
          type: 'secondary',
          icon: '📑',
        },
        {
          id: 'advisor',
          label: 'Advisor Agent',
          sublabel: 'Mistral + RAG',
          type: 'secondary',
          icon: '💡',
        },
        {
          id: 'vision',
          label: 'Vision Agent',
          sublabel: 'Gemini 2.5 Flash',
          type: 'highlight',
          icon: '👁️',
        },
      ],
    },
    {
      title: 'Data & Knowledge',
      color: 'from-green-500 to-emerald-600',
      nodes: [
        {
          id: 'graphrag',
          label: 'GraphRAG',
          sublabel: 'LlamaIndex + pgVector',
          type: 'secondary',
          icon: '🦙',
        },
        {
          id: 'websearch',
          label: 'Web Search',
          sublabel: 'Tavily Hybrid RAG',
          type: 'tertiary',
          icon: '🌐',
        },
        {
          id: 'otel-data',
          label: 'OTel Data',
          sublabel: 'Pre-computed State',
          type: 'tertiary',
          icon: '📈',
        },
      ],
    },
    {
      title: 'AI SDK v6 Protocol',
      color: 'from-cyan-500 to-blue-600',
      nodes: [
        {
          id: 'uimessagestream',
          label: 'UIMessageStream',
          sublabel: 'Native Streaming Protocol',
          type: 'highlight',
          icon: '📡',
        },
        {
          id: 'resumable',
          label: 'Resumable Stream v2',
          sublabel: 'Redis State + Auto-Reconnect',
          type: 'secondary',
          icon: '🔄',
        },
      ],
    },
  ],
  connections: [
    { from: 'user', to: 'vercel-proxy', label: 'POST' },
    { from: 'vercel-proxy', to: 'orchestrator', label: 'Proxy' },
    { from: 'orchestrator', to: 'nlq', label: 'Handoff' },
    { from: 'orchestrator', to: 'analyst', label: 'Handoff' },
    { from: 'orchestrator', to: 'reporter', label: 'Handoff' },
    { from: 'orchestrator', to: 'advisor', label: 'Handoff' },
    { from: 'orchestrator', to: 'vision', label: 'Handoff' },
    { from: 'nlq', to: 'otel-data', type: 'dashed' },
    { from: 'analyst', to: 'otel-data', type: 'dashed' },
    { from: 'advisor', to: 'graphrag', type: 'dashed' },
    { from: 'nlq', to: 'websearch', type: 'dashed' },
    { from: 'graphrag', to: 'uimessagestream', label: 'Context' },
    { from: 'orchestrator', to: 'uimessagestream', label: 'Stream' },
    { from: 'uimessagestream', to: 'resumable', type: 'dashed' },
    { from: 'uimessagestream', to: 'user', label: 'Response' },
  ],
};
