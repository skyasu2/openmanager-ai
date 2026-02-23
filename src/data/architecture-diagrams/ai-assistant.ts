import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const AI_ASSISTANT_ARCHITECTURE: ArchitectureDiagram = {
  id: 'ai-assistant',
  title: 'Multi-Agent Architecture (AI SDK v6)',
  description:
    'Vercel AI SDK v6 네이티브 ToolLoopAgent 기반 7-Agent 멀티 에이전트. Vision Agent(Gemini)로 스크린샷/로그 분석 지원. UIMessageStream 네이티브 프로토콜, Resumable Stream v2 적용.',
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
          icon: '▲', // Vercel Triangle
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
          sublabel: 'Cerebras llama-3.3-70b',
          type: 'highlight',
          icon: '🧠', // Brain for Orchestrator
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
          sublabel: 'Server Metrics (w/ Fallback)',
          type: 'secondary',
          icon: '🔍',
        },
        {
          id: 'analyst',
          label: 'Analyst Agent',
          sublabel: 'RCA & Anomaly (w/ Fallback)',
          type: 'secondary',
          icon: '📊',
        },
        {
          id: 'reporter',
          label: 'Reporter Agent',
          sublabel: 'Incident Report (w/ Fallback)',
          type: 'secondary',
          icon: '📑', // Document for report
        },
        {
          id: 'advisor',
          label: 'Advisor Agent',
          sublabel: 'GraphRAG + Reasoning',
          type: 'secondary',
          icon: '💡',
        },
        {
          id: 'vision',
          label: 'Vision Agent',
          sublabel: 'Gemini Flash',
          type: 'highlight',
          icon: '👁️',
        },
      ],
    },
    {
      title: 'Validation Layer',
      color: 'from-green-500 to-emerald-600',
      nodes: [
        {
          id: 'verifier',
          label: 'Verifier',
          sublabel: 'Response Validation',
          type: 'tertiary',
          icon: '✅',
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
    { from: 'nlq', to: 'verifier', type: 'dashed' },
    { from: 'analyst', to: 'verifier', type: 'dashed' },
    { from: 'reporter', to: 'verifier', type: 'dashed' },
    { from: 'advisor', to: 'verifier', type: 'dashed' },
    { from: 'vision', to: 'verifier', type: 'dashed' },
    { from: 'verifier', to: 'uimessagestream', label: 'Stream' },
    { from: 'uimessagestream', to: 'resumable', type: 'dashed' },
    { from: 'uimessagestream', to: 'user', label: 'Response' },
  ],
};
