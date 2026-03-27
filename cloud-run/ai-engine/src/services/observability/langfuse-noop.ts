import type { LangfuseClient, LangfuseTrace } from './langfuse-contracts';

export function createNoOpTrace(): LangfuseTrace {
  return {
    id: undefined,
    generation: () => ({}),
    span: () => ({}),
    event: () => ({}),
    update: () => {},
    score: () => {},
  };
}

export function createNoOpLangfuse(): LangfuseClient {
  const noOpTrace = createNoOpTrace();

  return {
    trace: () => noOpTrace,
    score: () => {},
    flushAsync: async () => {},
    shutdownAsync: async () => {},
  };
}
