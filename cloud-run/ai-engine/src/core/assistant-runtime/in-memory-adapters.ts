import type {
  AssistantArtifactStore,
  AssistantJobQueue,
  AssistantMessage,
  AssistantQueuedJob,
  AssistantQueuedJobInput,
  AssistantRuntimeAdapters,
  AssistantSessionStore,
  AssistantStateStore,
  AssistantVectorStore,
} from './types';

class InMemoryStateStore implements AssistantStateStore {
  private readonly values = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

class InMemorySessionStore implements AssistantSessionStore {
  private readonly sessions = new Map<string, AssistantMessage[]>();

  async loadMessages(sessionId: string): Promise<AssistantMessage[]> {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  async saveMessages(
    sessionId: string,
    messages: readonly AssistantMessage[]
  ): Promise<void> {
    this.sessions.set(sessionId, messages.map((message) => ({ ...message })));
  }
}

class InMemoryJobQueue implements AssistantJobQueue {
  private sequence = 0;
  private readonly jobs = new Map<string, AssistantQueuedJob>();

  async enqueue(input: AssistantQueuedJobInput): Promise<AssistantQueuedJob> {
    this.sequence += 1;
    const job: AssistantQueuedJob = {
      id: `job-${String(this.sequence).padStart(6, '0')}`,
      status: 'queued',
      requestId: input.requestId,
      domainId: input.domainId,
      payload: input.payload,
    };
    this.jobs.set(job.id, job);
    return { ...job };
  }
}

class InMemoryArtifactStore implements AssistantArtifactStore {
  private readonly artifacts = new Map<string, unknown>();

  async read<T = unknown>(key: string): Promise<T | undefined> {
    return this.artifacts.get(key) as T | undefined;
  }

  async write<T = unknown>(key: string, value: T): Promise<void> {
    this.artifacts.set(key, value);
  }
}

class EmptyVectorStore implements AssistantVectorStore {
  async search(): Promise<unknown[]> {
    return [];
  }
}

export function createInMemoryAssistantRuntimeAdapters(): AssistantRuntimeAdapters {
  return {
    stateStore: new InMemoryStateStore(),
    jobQueue: new InMemoryJobQueue(),
    sessionStore: new InMemorySessionStore(),
    artifactStore: new InMemoryArtifactStore(),
    vectorStore: new EmptyVectorStore(),
  };
}
