import { normalizeRetrievalMetadata } from '@/lib/ai/utils/retrieval-status';

export type DeveloperPanelData = {
  ts: string;
  session: {
    provider: string;
    modelId: string;
    handoffCount: number;
    durationMs: number;
    toolsCalled: string[];
  } | null;
  stream: {
    analysisBasis: string;
    stepsExecuted: number;
    tokensUsed?: number;
  } | null;
  system: {
    cloudRunHealthy: boolean;
    cloudRunUrl: string;
    disclosureMode: string;
  } | null;
  rag: {
    ragType: string;
    hitCount: number;
    graphHits: number;
    vectorHits: number;
  } | null;
};

export type DeveloperContextStreamPayload = {
  mode: 'developer';
  meta: DeveloperPanelData;
};

type DeveloperPanelPatch = Partial<
  Pick<DeveloperPanelData, 'session' | 'stream' | 'system' | 'rag'>
> & {
  ts?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  const number = normalizeNumber(value);
  return number === null ? null : Math.max(0, Math.floor(number));
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeString)
    .filter((entry): entry is string => entry !== null);
}

function readField(source: unknown, key: string): unknown {
  if (!isRecord(source)) return undefined;
  if (source[key] !== undefined) return source[key];

  const metadata = source.metadata;
  return isRecord(metadata) ? metadata[key] : undefined;
}

function normalizeSession(value: unknown): DeveloperPanelData['session'] {
  if (!isRecord(value)) return null;

  const provider = normalizeString(value.provider);
  const modelId = normalizeString(value.modelId);
  const handoffCount = normalizeNonNegativeInteger(value.handoffCount);
  const durationMs = normalizeNonNegativeInteger(value.durationMs);
  if (!provider || !modelId || handoffCount === null || durationMs === null) {
    return null;
  }

  return {
    provider,
    modelId,
    handoffCount,
    durationMs,
    toolsCalled: normalizeStringArray(value.toolsCalled),
  };
}

function normalizeStream(value: unknown): DeveloperPanelData['stream'] {
  if (!isRecord(value)) return null;

  const analysisBasis = normalizeString(value.analysisBasis);
  const stepsExecuted = normalizeNonNegativeInteger(value.stepsExecuted);
  if (!analysisBasis || stepsExecuted === null) return null;

  const tokensUsed = normalizeNonNegativeInteger(value.tokensUsed);
  return {
    analysisBasis,
    stepsExecuted,
    ...(tokensUsed !== null ? { tokensUsed } : {}),
  };
}

function normalizeSystem(value: unknown): DeveloperPanelData['system'] {
  if (!isRecord(value) || typeof value.cloudRunHealthy !== 'boolean') {
    return null;
  }

  const cloudRunUrl = normalizeString(value.cloudRunUrl);
  const disclosureMode = normalizeString(value.disclosureMode);
  if (!cloudRunUrl || !disclosureMode) return null;

  return {
    cloudRunHealthy: value.cloudRunHealthy,
    cloudRunUrl,
    disclosureMode,
  };
}

function normalizeRag(value: unknown): DeveloperPanelData['rag'] {
  if (!isRecord(value)) return null;

  const ragType = normalizeString(value.ragType);
  const hitCount = normalizeNonNegativeInteger(value.hitCount);
  const graphHits = normalizeNonNegativeInteger(value.graphHits);
  const vectorHits = normalizeNonNegativeInteger(value.vectorHits);
  if (
    !ragType ||
    hitCount === null ||
    graphHits === null ||
    vectorHits === null
  ) {
    return null;
  }

  return {
    ragType,
    hitCount,
    graphHits,
    vectorHits,
  };
}

export function normalizeDeveloperPanelData(
  value: unknown
): DeveloperPanelData | null {
  if (!isRecord(value)) return null;

  const ts = normalizeString(value.ts);
  if (!ts) return null;

  return {
    ts,
    session: value.session === null ? null : normalizeSession(value.session),
    stream: value.stream === null ? null : normalizeStream(value.stream),
    system: value.system === null ? null : normalizeSystem(value.system),
    rag: value.rag === null ? null : normalizeRag(value.rag),
  };
}

export function createDeveloperPanelData(params: {
  cloudRunHealthy: boolean;
  cloudRunUrl: string;
  disclosureMode: string;
  ts?: string;
}): DeveloperPanelData {
  return {
    ts: params.ts ?? new Date().toISOString(),
    session: null,
    stream: null,
    system: {
      cloudRunHealthy: params.cloudRunHealthy,
      cloudRunUrl: params.cloudRunUrl,
      disclosureMode: params.disclosureMode,
    },
    rag: null,
  };
}

export function createDeveloperContextStreamPayload(params: {
  cloudRunHealthy: boolean;
  cloudRunUrl: string;
  disclosureMode: string;
  ts?: string;
}): DeveloperContextStreamPayload {
  return {
    mode: 'developer',
    meta: createDeveloperPanelData(params),
  };
}

export function normalizeDeveloperContextStreamPayload(
  value: unknown
): DeveloperPanelData | null {
  if (!isRecord(value) || value.mode !== 'developer') return null;
  return normalizeDeveloperPanelData(value.meta);
}

export function mergeDeveloperPanelData(
  previous: DeveloperPanelData,
  patch: DeveloperPanelPatch
): DeveloperPanelData {
  return {
    ts: patch.ts ?? new Date().toISOString(),
    session:
      patch.session === undefined ? previous.session : (patch.session ?? null),
    stream:
      patch.stream === undefined ? previous.stream : (patch.stream ?? null),
    system:
      patch.system === undefined ? previous.system : (patch.system ?? null),
    rag: patch.rag === undefined ? previous.rag : (patch.rag ?? null),
  };
}

export function buildDeveloperPanelPatchFromDoneData(
  doneData: unknown,
  options: {
    fallbackSystem?: DeveloperPanelData['system'];
    pendingToolNames?: string[];
    pendingHandoffCount?: number;
  } = {}
): DeveloperPanelPatch {
  const provider = normalizeString(readField(doneData, 'provider'));
  const modelId = normalizeString(readField(doneData, 'modelId'));
  const durationMs =
    normalizeNonNegativeInteger(readField(doneData, 'durationMs')) ??
    normalizeNonNegativeInteger(readField(doneData, 'processingTime')) ??
    normalizeNonNegativeInteger(readField(doneData, 'processingTimeMs')) ??
    0;
  const toolsCalled = normalizeStringArray(readField(doneData, 'toolsCalled'));
  const resolvedTools =
    toolsCalled.length > 0 ? toolsCalled : (options.pendingToolNames ?? []);
  const handoffCount =
    normalizeNonNegativeInteger(readField(doneData, 'handoffCount')) ??
    options.pendingHandoffCount ??
    0;
  const resolvedMode = normalizeString(readField(doneData, 'resolvedMode'));
  const isFallback =
    readField(doneData, 'fallback') === true ||
    readField(doneData, 'usedFallback') === true;
  const analysisBasis = isFallback
    ? 'fallback'
    : resolvedMode === 'multi'
      ? 'multi-agent'
      : resolvedMode === 'single'
        ? 'single-agent'
        : normalizeString(readField(doneData, 'analysisBasis'));
  const stepsExecuted =
    normalizeNonNegativeInteger(readField(doneData, 'stepsExecuted')) ??
    Math.max(handoffCount, resolvedTools.length);
  const tokensUsed = normalizeNonNegativeInteger(
    readField(doneData, 'tokensUsed')
  );
  const retrieval = normalizeRetrievalMetadata(
    readField(doneData, 'retrieval')
  );
  const graphHits =
    normalizeNonNegativeInteger(readField(doneData, 'graphHits')) ?? 0;
  const retrievalHitCount = retrieval?.evidenceCount ?? 0;
  const vectorHits =
    normalizeNonNegativeInteger(readField(doneData, 'vectorHits')) ??
    Math.max(0, retrievalHitCount - graphHits);

  return {
    ...(provider && modelId
      ? {
          session: {
            provider,
            modelId,
            handoffCount,
            durationMs,
            toolsCalled: resolvedTools,
          },
        }
      : {}),
    ...(analysisBasis
      ? {
          stream: {
            analysisBasis,
            stepsExecuted,
            ...(tokensUsed !== null ? { tokensUsed } : {}),
          },
        }
      : {}),
    ...(options.fallbackSystem ? { system: options.fallbackSystem } : {}),
    ...(retrieval
      ? {
          rag: {
            ragType: retrieval.retrievalMode,
            hitCount: retrieval.evidenceCount,
            graphHits,
            vectorHits,
          },
        }
      : {}),
  };
}
