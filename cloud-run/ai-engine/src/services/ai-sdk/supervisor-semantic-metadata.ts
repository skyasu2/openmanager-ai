import type {
  AssistantInputType,
  DomainIntentAmbiguity,
  DomainIntentExecutionMode,
  DomainIntentFrame,
  DomainIntentScope,
} from '../../core/assistant-runtime';
import { isValidMonitoringSemanticFrameReference } from './routing/semantic-frame-policy';

export type SupervisorSemanticMetadataReasonCode = 'semantic_frame_invalid';

export interface SemanticQueryTrace {
  originalQuery: string;
  selectedDomain?: string;
  selectedCapability?: string;
  selectedEvidenceProvider?: string;
  evidenceAvailable: boolean;
  clarificationRequired: boolean;
  reasonCodes: string[];
}

export interface SupervisorSemanticMetadataResult {
  metadata?: Record<string, unknown>;
  reasonCodes: SupervisorSemanticMetadataReasonCode[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const values = value
    .map(readString)
    .filter((item): item is string => item !== undefined);
  return values.length === value.length ? values : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function isDomainIntentScope(value: string): value is DomainIntentScope {
  return ['whole_fleet', 'entity', 'group', 'unknown'].includes(value);
}

function isDomainIntentAmbiguity(
  value: string
): value is DomainIntentAmbiguity {
  return ['low', 'medium', 'high'].includes(value);
}

function isDomainIntentExecutionMode(
  value: string
): value is DomainIntentExecutionMode {
  return ['single', 'multi', 'unknown'].includes(value);
}

export function normalizeSupervisorInputType(
  value: unknown
): AssistantInputType | undefined {
  return value === 'natural_query' ||
    value === 'log_paste' ||
    value === 'mixed' ||
    value === 'oversized'
    ? value
    : undefined;
}

function normalizeLogExtract(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 8_000);
}

export function normalizeSupervisorIntentFrame(
  value: unknown
): DomainIntentFrame | undefined {
  if (!isRecord(value)) return undefined;

  const domainId = readString(value.domainId);
  const intent = readString(value.intent);
  const scope = readString(value.scope);
  const targets = readStringArray(value.targets);
  const ambiguity = readString(value.ambiguity);
  const confidence = readFiniteNumber(value.confidence);
  const capabilityId = readString(value.capabilityId);
  const metric = readString(value.metric);
  const timeWindow = readString(value.timeWindow);
  const aggregation = readString(value.aggregation);
  const topN = readFiniteNumber(value.topN);
  const executionMode = readString(value.executionMode);
  const normalizedExecutionMode =
    executionMode && isDomainIntentExecutionMode(executionMode)
      ? executionMode
      : undefined;

  if (
    !domainId ||
    !intent ||
    !scope ||
    !isDomainIntentScope(scope) ||
    targets === undefined ||
    !ambiguity ||
    !isDomainIntentAmbiguity(ambiguity) ||
    confidence === undefined
  ) {
    return undefined;
  }

  if (
    !isValidMonitoringSemanticFrameReference({
      domainId,
      intent,
      capabilityId,
    })
  ) {
    return undefined;
  }

  return {
    domainId,
    intent,
    scope,
    targets,
    ambiguity,
    confidence,
    ...(capabilityId && { capabilityId }),
    ...(metric && { metric }),
    ...(timeWindow && { timeWindow }),
    ...(aggregation && { aggregation }),
    ...(topN !== undefined && { topN }),
    ...(normalizedExecutionMode && {
      executionMode: normalizedExecutionMode,
    }),
    ...(isRecord(value.slots) && { slots: value.slots }),
  };
}

export function normalizeSemanticQueryTrace(
  value: unknown
): SemanticQueryTrace | undefined {
  if (!isRecord(value)) return undefined;

  const originalQuery = readString(value.originalQuery);
  const reasonCodes = readStringArray(value.reasonCodes);
  if (!originalQuery || reasonCodes === undefined) return undefined;

  const selectedDomain = readString(value.selectedDomain);
  const selectedCapability = readString(value.selectedCapability);
  const selectedEvidenceProvider = readString(value.selectedEvidenceProvider);

  return {
    originalQuery,
    ...(selectedDomain && { selectedDomain }),
    ...(selectedCapability && { selectedCapability }),
    ...(selectedEvidenceProvider && { selectedEvidenceProvider }),
    evidenceAvailable: value.evidenceAvailable === true,
    clarificationRequired: value.clarificationRequired === true,
    reasonCodes,
  };
}

export function normalizeSupervisorSemanticMetadata(params: {
  metadata?: unknown;
  semanticQueryTrace?: unknown;
}): SupervisorSemanticMetadataResult {
  const inputMetadata = isRecord(params.metadata)
    ? params.metadata
    : undefined;
  const rawIntentFrame = inputMetadata?.intentFrame;
  const inputType = normalizeSupervisorInputType(inputMetadata?.inputType);
  const logExtract = normalizeLogExtract(inputMetadata?.logExtract);
  const trace = normalizeSemanticQueryTrace(
    params.semanticQueryTrace ?? inputMetadata?.semanticQueryTrace
  );

  if (rawIntentFrame === undefined) {
    const metadata = {
      ...(trace && { semanticQueryTrace: trace }),
      ...(inputType && { inputType }),
      ...(logExtract &&
      (inputType === 'log_paste' || inputType === 'mixed')
        ? { logExtract }
        : {}),
    };
    return Object.keys(metadata).length > 0
      ? { metadata, reasonCodes: [] }
      : { reasonCodes: [] };
  }

  const intentFrame = normalizeSupervisorIntentFrame(rawIntentFrame);
  if (!intentFrame) {
    return { reasonCodes: ['semantic_frame_invalid'] };
  }

  return {
    metadata: {
      ...inputMetadata,
      intentFrame,
      ...(inputType && { inputType }),
      ...(logExtract &&
      (inputType === 'log_paste' || inputType === 'mixed')
        ? { logExtract }
        : {}),
      ...(trace && { semanticQueryTrace: trace }),
    },
    reasonCodes: [],
  };
}
