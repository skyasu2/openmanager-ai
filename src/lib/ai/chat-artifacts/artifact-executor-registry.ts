import type { JobDataSlot } from '@/types/ai-jobs';
import type { ChatArtifactIntent } from './artifact-intent-contract';
import type { ChatArtifact } from './types';

export type ArtifactExecutorIntent = Exclude<
  ChatArtifactIntent,
  { kind: 'guidance' } | { kind: 'none' }
>;

export interface ArtifactExecutorKeyInput {
  kind: string;
}

export interface ArtifactExecutorContext<
  TIntent extends ArtifactExecutorIntent = ArtifactExecutorIntent,
> {
  artifactIntent: TIntent;
  query: string;
  sessionId: string;
  queryAsOfDataSlot?: JobDataSlot;
  signal: AbortSignal;
  readPreviousArtifact?: (kind: string) => ChatArtifact | undefined;
}

export type ArtifactExecutorFn<
  TIntent extends ArtifactExecutorIntent = ArtifactExecutorIntent,
> = (context: ArtifactExecutorContext<TIntent>) => Promise<ChatArtifact | null>;

type ArtifactExecutorCleanup = () => void;

const artifactExecutorMap = new Map<string, ArtifactExecutorFn>();

function readArtifactExecutorKey(input: ArtifactExecutorKeyInput | string) {
  return typeof input === 'string' ? input : input.kind;
}

export function registerArtifactExecutor(
  input: ArtifactExecutorKeyInput,
  executor: ArtifactExecutorFn
): ArtifactExecutorCleanup {
  const key = readArtifactExecutorKey(input);
  const previousExecutor = artifactExecutorMap.get(key);
  artifactExecutorMap.set(key, executor);

  return () => {
    if (artifactExecutorMap.get(key) !== executor) return;
    if (previousExecutor) {
      artifactExecutorMap.set(key, previousExecutor);
      return;
    }
    artifactExecutorMap.delete(key);
  };
}

export function resolveArtifactExecutor(
  input: ArtifactExecutorKeyInput | string
): ArtifactExecutorFn | undefined {
  return artifactExecutorMap.get(readArtifactExecutorKey(input));
}
