/**
 * Architecture Diagrams Data
 * 랜딩 페이지 Feature Card 모달용 아키텍처 다이어그램 데이터
 *
 * ⚠️ SYNC: docs/reference/architecture/ 다이어그램과 동기화 필요
 * - system-architecture-current.md (ASCII)
 * - ai-engine-architecture.md (Mermaid + ASCII)
 * - hybrid-split.md (ASCII)
 *
 * @version 6.1.0
 * @updated 2026-01-25
 */

export interface DiagramNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'primary' | 'secondary' | 'tertiary' | 'highlight';
  icon?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  type?: 'solid' | 'dashed';
}

export interface DiagramLayer {
  title: string;
  color: string;
  nodes: DiagramNode[];
}

export interface ArchitectureDiagram {
  id: string;
  title: string;
  description: string;
  layers: DiagramLayer[];
  connections?: DiagramConnection[];
}

/**
 * 4개 카드별 아키텍처 다이어그램 데이터
 */
export const ARCHITECTURE_DIAGRAMS: Record<string, ArchitectureDiagram> = {
  /**
   * 1. AI Assistant - Multi-Agent 오케스트레이션
   * @sync docs/reference/architecture/ai/ai-engine-architecture.md
   * @version v6.1.0 - AI SDK v6 Native (UIMessageStream, Resumable Stream v2)
   */
  'ai-assistant-pro': {
    id: 'ai-assistant-pro',
    title: 'Multi-Agent Architecture (AI SDK v6)',
    description:
      'Vercel AI SDK v6 + @ai-sdk-tools/agents 기반 6-Agent 멀티 에이전트. Vision Agent(Gemini)로 스크린샷/로그 분석 지원. UIMessageStream 네이티브 프로토콜, Resumable Stream v2 적용.',
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
  },

  /**
   * 2. Cloud Platform - Hybrid Infrastructure
   * @sync docs/reference/architecture/infrastructure/hybrid-split.md
   */
  'cloud-platform': {
    id: 'cloud-platform',
    title: 'Hybrid Cloud Architecture',
    description:
      '4개 클라우드 플랫폼 연동. Vercel(Frontend) + Cloud Run(AI) + Supabase(DB) + Upstash(Cache). 독립적 스케일링.',
    layers: [
      {
        title: 'Compute Layer',
        color: 'from-slate-600 to-slate-700',
        nodes: [
          {
            id: 'vercel',
            label: 'Vercel',
            sublabel: 'Next.js 16 + Edge CDN',
            type: 'primary',
            icon: '▲',
          },
          {
            id: 'cloudrun',
            label: 'Cloud Run',
            sublabel: 'Node.js 22 + Hono + AI SDK',
            type: 'highlight',
            icon: '🚀', // Rocket for Cloud Run
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
            sublabel: 'PostgreSQL + pgVector + RLS',
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
        title: 'Platform Features',
        color: 'from-purple-500 to-pink-500',
        nodes: [
          {
            id: 'feature-1',
            label: 'Scale to Zero',
            sublabel: '무료 티어 최적화',
            type: 'tertiary',
            icon: '📉',
          },
          {
            id: 'feature-2',
            label: 'Auto Scaling',
            sublabel: '트래픽 기반 확장',
            type: 'tertiary',
            icon: '📈',
          },
          {
            id: 'feature-3',
            label: 'Global CDN',
            sublabel: 'Edge 배포',
            type: 'tertiary',
            icon: '🌍',
          },
        ],
      },
    ],
    connections: [
      { from: 'vercel', to: 'supabase', label: 'Query' },
      { from: 'vercel', to: 'cloudrun', label: 'AI Proxy' },
      { from: 'cloudrun', to: 'supabase', label: 'GraphRAG' },
      { from: 'vercel', to: 'upstash', label: 'Cache' },
      { from: 'cloudrun', to: 'upstash', label: 'Cache' },
    ],
  },

  /**
   * 3. Tech Stack - Frontend Architecture
   * @sync docs/reference/architecture/system/system-architecture-current.md
   */
  'tech-stack': {
    id: 'tech-stack',
    title: 'Frontend Architecture',
    description:
      'Next.js 16 + React 19 + TypeScript 5.9 기반 Next-Gen 프론트엔드 스택. 레이어별 기술 분리.',
    layers: [
      {
        title: 'Presentation Layer',
        color: 'from-pink-500 to-rose-500',
        nodes: [
          {
            id: 'react',
            label: 'React 19',
            sublabel: 'Server Components',
            type: 'primary',
            icon: '⚛️',
          },
          {
            id: 'tailwind',
            label: 'Tailwind CSS 4.1',
            sublabel: 'Oxides Engine',
            type: 'secondary',
            icon: '🎨',
          },
          {
            id: 'animate',
            label: 'Tailwind Animate',
            sublabel: 'CSS Animations',
            type: 'secondary',
            icon: '🎭', // Mask for animation/drama
          },
        ],
      },
      {
        title: 'State Layer',
        color: 'from-amber-500 to-orange-500',
        nodes: [
          {
            id: 'zustand',
            label: 'Zustand 5.0',
            sublabel: 'Global State',
            type: 'primary',
            icon: '🐻',
          },
          {
            id: 'tanstack',
            label: 'TanStack Query v5',
            sublabel: 'Server State',
            type: 'secondary',
            icon: '📡', // Satellite for remote data
          },
          {
            id: 'hooks',
            label: 'React 19 Hooks',
            sublabel: 'Local State',
            type: 'tertiary',
            icon: '⚓', // Hook
          },
        ],
      },
      {
        title: 'Framework Layer',
        color: 'from-blue-500 to-indigo-600',
        nodes: [
          {
            id: 'nextjs',
            label: 'Next.js 16',
            sublabel: 'App Router + PPR',
            type: 'highlight',
            icon: '▲',
          },
          {
            id: 'typescript',
            label: 'TypeScript 5.9',
            sublabel: 'Strict Mode',
            type: 'primary',
            icon: '📘', // Blue book for TS
          },
          {
            id: 'radix',
            label: 'Radix UI',
            sublabel: 'Accessible Primitives',
            type: 'secondary',
            icon: '🧩',
          },
        ],
      },
      {
        title: 'Build & Tools',
        color: 'from-gray-500 to-gray-600',
        nodes: [
          {
            id: 'biome',
            label: 'Biome',
            sublabel: 'Lint + Format',
            type: 'tertiary',
            icon: '🌿',
          },
          {
            id: 'vitest',
            label: 'Vitest',
            sublabel: 'Unit Tests',
            type: 'tertiary',
            icon: '🧪',
          },
          {
            id: 'playwright',
            label: 'Playwright',
            sublabel: 'E2E Tests',
            type: 'tertiary',
            icon: '🎭',
          },
        ],
      },
    ],
    connections: [
      // Framework → Presentation
      { from: 'nextjs', to: 'react', label: 'Renders' },
      { from: 'radix', to: 'react', label: 'Components' },
      { from: 'tailwind', to: 'react', label: 'Styles' },
      // State → Presentation
      { from: 'zustand', to: 'react', label: 'Global' },
      { from: 'hooks', to: 'react', label: 'Local' },
      // State → Framework
      { from: 'tanstack', to: 'nextjs', label: 'Server State' },
      // Framework internal
      { from: 'typescript', to: 'nextjs', label: 'Types' },
      // Build → Framework
      { from: 'biome', to: 'typescript', label: 'Lint' },
      { from: 'vitest', to: 'nextjs', label: 'Test' },
    ],
  },

  /**
   * 4. Vibe Coding - Development Environment
   * Note: Google Antigravity IDE 사용 중 (Cursor/VSCode는 미사용)
   * @sync .claude/rules/ai-tools.md (MCP Servers 목록)
   */
  'vibe-coding': {
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
            sublabel: 'Main Agent (v2.0+)',
            type: 'highlight',
            icon: '🤖',
          },
          {
            id: 'codex',
            label: 'Codex CLI',
            sublabel: 'Code Review Primary',
            type: 'secondary',
            icon: '🔍',
          },
          {
            id: 'gemini',
            label: 'Gemini CLI',
            sublabel: 'Code Review Secondary',
            type: 'secondary',
            icon: '💎',
          },
        ],
      },
      {
        title: 'MCP Servers (8개)',
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
        ],
      },
    ],
    connections: [
      { from: 'antigravity', to: 'claude-code', label: 'Terminal' },
      { from: 'claude-code', to: 'codex', label: '2-AI Review' },
      { from: 'claude-code', to: 'gemini', label: '2-AI Review' },
      // MCP Servers (8개)
      { from: 'claude-code', to: 'context7', label: 'MCP' },
      { from: 'claude-code', to: 'supabase-mcp', label: 'MCP' },
      { from: 'claude-code', to: 'vercel-mcp', label: 'MCP' },
      { from: 'claude-code', to: 'playwright-mcp', label: 'MCP' },
      { from: 'claude-code', to: 'next-devtools-mcp', label: 'MCP' },
      { from: 'claude-code', to: 'github-mcp', label: 'MCP' },
      { from: 'claude-code', to: 'seq-think', label: 'MCP' },
      { from: 'claude-code', to: 'stitch-mcp', label: 'MCP' },
    ],
  },

  /**
   * 5. Infrastructure Topology - 15 Server Monitoring Architecture
   * 실제 모니터링 대상 인프라의 서비스 의존성 그래프
   * @sync src/data/otel-data/hourly/*.json (15 servers, OTel-native format)
   * @sync src/config/server-services-map.ts (hostname → service mapping)
   */
  'infrastructure-topology': {
    id: 'infrastructure-topology',
    title: 'OnPrem DC1 서비스 토폴로지',
    description:
      '15대 Active 서버의 계층 의존성. AZ1/AZ2/AZ3 가용 영역 기반, LB → Web → API → DB/Cache → Storage.',
    layers: [
      {
        title: 'Load Balancer',
        color: 'from-red-500 to-orange-500',
        nodes: [
          {
            id: 'lb-haproxy-dc1-01',
            label: 'HAProxy-01 (AZ1)',
            sublabel: '10.100.1.1 :443',
            type: 'highlight',
            icon: '🔀',
          },
          {
            id: 'lb-haproxy-dc1-02',
            label: 'HAProxy-02 (AZ3)',
            sublabel: '10.100.2.1 :443',
            type: 'highlight',
            icon: '🔀',
          },
        ],
      },
      {
        title: 'Web Tier (Nginx)',
        color: 'from-blue-500 to-cyan-500',
        nodes: [
          {
            id: 'web-nginx-dc1-01',
            label: 'Nginx-01 (AZ1)',
            sublabel: '10.100.1.11 :80',
            type: 'primary',
            icon: '🌐',
          },
          {
            id: 'web-nginx-dc1-02',
            label: 'Nginx-02 (AZ2)',
            sublabel: '10.100.1.12 :80',
            type: 'primary',
            icon: '🌐',
          },
          {
            id: 'web-nginx-dc1-03',
            label: 'Nginx-03 (AZ3)',
            sublabel: '10.100.2.11 :80',
            type: 'primary',
            icon: '🌐',
          },
        ],
      },
      {
        title: 'API Tier (WAS)',
        color: 'from-green-500 to-emerald-500',
        nodes: [
          {
            id: 'api-was-dc1-01',
            label: 'WAS-01 (AZ1)',
            sublabel: '10.100.1.21 :8080',
            type: 'primary',
            icon: '⚙️',
          },
          {
            id: 'api-was-dc1-02',
            label: 'WAS-02 (AZ2)',
            sublabel: '10.100.1.22 :8080',
            type: 'primary',
            icon: '⚙️',
          },
          {
            id: 'api-was-dc1-03',
            label: 'WAS-03 (AZ3)',
            sublabel: '10.100.2.21 :8080',
            type: 'primary',
            icon: '⚙️',
          },
        ],
      },
      {
        title: 'Data Tier',
        color: 'from-purple-500 to-indigo-500',
        nodes: [
          {
            id: 'db-mysql-dc1-primary',
            label: 'MySQL Primary (AZ1)',
            sublabel: '10.100.1.31 :3306',
            type: 'highlight',
            icon: '🗄️',
          },
          {
            id: 'db-mysql-dc1-replica',
            label: 'MySQL Replica (AZ2)',
            sublabel: '10.100.1.32 :3306',
            type: 'secondary',
            icon: '🗄️',
          },
          {
            id: 'db-mysql-dc1-backup',
            label: 'MySQL Standby (AZ3)',
            sublabel: '10.100.2.31 :3306',
            type: 'secondary',
            icon: '🗄️',
          },
          {
            id: 'cache-redis-dc1-01',
            label: 'Redis Master (AZ1)',
            sublabel: '10.100.1.41 :6379',
            type: 'primary',
            icon: '⚡',
          },
          {
            id: 'cache-redis-dc1-02',
            label: 'Redis Replica (AZ2)',
            sublabel: '10.100.1.42 :6379',
            type: 'secondary',
            icon: '⚡',
          },
        ],
      },
      {
        title: 'Storage Tier',
        color: 'from-amber-500 to-yellow-500',
        nodes: [
          {
            id: 'storage-nfs-dc1-01',
            label: 'NFS Storage (AZ1)',
            sublabel: '10.100.1.51 :2049',
            type: 'primary',
            icon: '💾',
          },
          {
            id: 'storage-s3gw-dc1-01',
            label: 'S3 Gateway (AZ3)',
            sublabel: '10.100.2.51 :9000',
            type: 'primary',
            icon: '📦',
          },
        ],
      },
    ],
    connections: [
      // LB -> Web
      { from: 'lb-haproxy-dc1-01', to: 'web-nginx-dc1-01', label: 'L7 Route' },
      { from: 'lb-haproxy-dc1-01', to: 'web-nginx-dc1-02' },
      { from: 'lb-haproxy-dc1-02', to: 'web-nginx-dc1-03', label: 'L7 Route' },
      {
        from: 'lb-haproxy-dc1-02',
        to: 'web-nginx-dc1-01',
        label: 'Failover',
        type: 'dashed',
      },
      { from: 'lb-haproxy-dc1-02', to: 'web-nginx-dc1-02', type: 'dashed' },
      // Web -> API
      {
        from: 'web-nginx-dc1-01',
        to: 'api-was-dc1-01',
        label: 'Reverse Proxy',
      },
      { from: 'web-nginx-dc1-02', to: 'api-was-dc1-02' },
      { from: 'web-nginx-dc1-03', to: 'api-was-dc1-03' },
      // API -> DB
      { from: 'api-was-dc1-01', to: 'db-mysql-dc1-primary', label: 'R/W' },
      { from: 'api-was-dc1-02', to: 'db-mysql-dc1-replica', label: 'Read' },
      {
        from: 'api-was-dc1-03',
        to: 'db-mysql-dc1-backup',
        label: 'Read',
        type: 'dashed',
      },
      // API -> Cache
      {
        from: 'api-was-dc1-01',
        to: 'cache-redis-dc1-01',
        label: 'Session/Cache',
      },
      { from: 'api-was-dc1-02', to: 'cache-redis-dc1-02' },
      {
        from: 'api-was-dc1-03',
        to: 'cache-redis-dc1-02',
        label: 'Cache Fallback',
        type: 'dashed',
      },
      // DB Replication
      {
        from: 'db-mysql-dc1-primary',
        to: 'db-mysql-dc1-replica',
        label: 'Replication',
        type: 'dashed',
      },
      {
        from: 'db-mysql-dc1-primary',
        to: 'db-mysql-dc1-backup',
        label: 'Async Repl.',
        type: 'dashed',
      },
      // API -> Storage
      {
        from: 'api-was-dc1-01',
        to: 'storage-nfs-dc1-01',
        label: 'File I/O',
        type: 'dashed',
      },
      {
        from: 'api-was-dc1-03',
        to: 'storage-s3gw-dc1-01',
        label: 'Object Store',
        type: 'dashed',
      },
    ],
  },
};

/**
 * 카드 ID로 다이어그램 데이터 조회
 */
export function getDiagramByCardId(cardId: string): ArchitectureDiagram | null {
  return ARCHITECTURE_DIAGRAMS[cardId] || null;
}
