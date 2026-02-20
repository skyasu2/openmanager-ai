export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  flushAt?: number;
  flushInterval?: number;
}

export interface LangfuseTrace {
  id?: string;
  generation: (params: {
    name: string;
    model: string;
    input: unknown;
    output?: string;
    usage?: { input: number; output: number; total: number };
    metadata?: Record<string, unknown>;
  }) => unknown;
  span: (params: {
    name: string;
    input: object;
    output: object;
    metadata?: Record<string, unknown>;
  }) => unknown;
  event: (params: { name: string; metadata?: Record<string, unknown> }) => unknown;
  update: (params: { output: string; metadata?: Record<string, unknown> }) => void;
  score: (params: { name: string; value: number }) => void;
}

export interface LangfuseClient {
  trace: (params: {
    name: string;
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
    input?: string;
  }) => LangfuseTrace;
  score: (params: {
    traceId: string;
    name: string;
    value: number;
  }) => void;
  flushAsync: () => Promise<void>;
  shutdownAsync: () => Promise<void>;
}

export type LangfuseConstructor = new (config: LangfuseConfig) => LangfuseClient;

export interface TraceMetadata {
  sessionId: string;
  userId?: string;
  mode?: 'single' | 'multi' | 'auto';
  query: string;
  /** Upstream trace ID from Vercel API (W3C traceparent). Links Cloud Run trace to client trace. */
  upstreamTraceId?: string;
}

export interface GenerationParams {
  model: string;
  provider: string;
  input: string | object;
  output?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface TimeoutEventContext {
  operation: string;
  elapsed: number;
  threshold: number;
  sessionId?: string;
}

export interface TimeoutSpanHandle {
  complete: (success: boolean, elapsed: number) => void;
}
