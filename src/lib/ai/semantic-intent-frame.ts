import {
  ENTITY_CONFIDENCE_THRESHOLD,
  type SemanticIntentFrame,
} from './entity-extractor';
import type { InputType } from './query-guard';

export type SemanticFrameReasonCode =
  | 'semantic_frame_low_confidence'
  | 'semantic_frame_high_ambiguity'
  | 'semantic_frame_unknown_domain'
  | 'semantic_frame_unknown_intent';

export interface DomainIntentFramePayload {
  domainId: string;
  intent: string;
  capabilityId: string;
  scope: 'whole_fleet' | 'entity' | 'group' | 'unknown';
  targets: string[];
  metric?: string;
  timeWindow?: string;
  aggregation?: string;
  topN?: number;
  ambiguity: 'low' | 'medium' | 'high';
  executionMode?: 'single' | 'multi' | 'unknown';
  confidence: number;
}

export interface SemanticQueryTrace {
  originalQuery: string;
  selectedDomain?: string;
  selectedCapability?: string;
  selectedEvidenceProvider?: string;
  evidenceAvailable: boolean;
  clarificationRequired: boolean;
  reasonCodes: string[];
}

export interface SemanticIntentFrameMapping {
  intentFrame?: DomainIntentFramePayload;
  reasonCodes: SemanticFrameReasonCode[];
}

export interface SemanticIntentRequestMetadata {
  metadata?: {
    intentFrame?: DomainIntentFramePayload;
    inputType?: InputType;
    logExtract?: string;
  };
  semanticQueryTrace?: SemanticQueryTrace;
}

export interface SemanticPreprocessingMetadata {
  inputType?: InputType;
  logExtract?: string;
  truncated?: boolean;
}

const DOMAIN_ID_BY_SEMANTIC_DOMAIN = {
  monitoring: 'openmanager-monitoring',
} as const;

const CAPABILITY_ID_BY_SEMANTIC_INTENT = {
  metric_peak: 'monitoring.metric_peak',
  metric_current: 'monitoring.metric_current',
  metric_trend: 'monitoring.metric_trend',
  server_health: 'monitoring.server_health',
  root_cause: 'monitoring.root_cause',
  incident_report: 'monitoring.incident_report',
  ops_advice: 'monitoring.ops_advice',
  log_analysis: 'monitoring.log_analysis',
} as const;

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

function mapSemanticScope(
  scope: SemanticIntentFrame['scope']
): DomainIntentFramePayload['scope'] {
  return scope === 'server' ? 'entity' : scope;
}

function normalizeConfidence(confidence: number): number {
  const normalized = Math.max(0, Math.min(100, confidence)) / 100;
  return Math.round(normalized * 100) / 100;
}

function normalizePreprocessingMetadata(
  value: SemanticPreprocessingMetadata | undefined | null
): Pick<SemanticPreprocessingMetadata, 'inputType' | 'logExtract'> | undefined {
  if (!value?.inputType) return undefined;

  const metadata: Pick<
    SemanticPreprocessingMetadata,
    'inputType' | 'logExtract'
  > = {
    inputType: value.inputType,
  };
  const logExtract = value.logExtract?.trim();
  if (
    logExtract &&
    (value.inputType === 'log_paste' || value.inputType === 'mixed')
  ) {
    metadata.logExtract = logExtract.slice(0, 8_000);
  }

  return metadata;
}

export function toDomainIntentFrame(
  frame: SemanticIntentFrame | undefined | null
): SemanticIntentFrameMapping {
  if (!frame) return { reasonCodes: [] };

  if (frame.confidence < ENTITY_CONFIDENCE_THRESHOLD) {
    return { reasonCodes: ['semantic_frame_low_confidence'] };
  }

  if (frame.ambiguity === 'high') {
    return { reasonCodes: ['semantic_frame_high_ambiguity'] };
  }

  const domainId =
    DOMAIN_ID_BY_SEMANTIC_DOMAIN[
      frame.domain as keyof typeof DOMAIN_ID_BY_SEMANTIC_DOMAIN
    ];
  if (!domainId) {
    return { reasonCodes: ['semantic_frame_unknown_domain'] };
  }

  const capabilityId =
    CAPABILITY_ID_BY_SEMANTIC_INTENT[
      frame.intent as keyof typeof CAPABILITY_ID_BY_SEMANTIC_INTENT
    ];
  if (!capabilityId) {
    return { reasonCodes: ['semantic_frame_unknown_intent'] };
  }

  return {
    intentFrame: {
      domainId,
      intent: frame.intent,
      capabilityId,
      scope: mapSemanticScope(frame.scope),
      targets: frame.targets,
      metric: frame.metric,
      timeWindow: frame.timeWindow,
      aggregation: frame.aggregation,
      ...(typeof frame.topN === 'number' && { topN: frame.topN }),
      ambiguity: frame.ambiguity,
      executionMode: frame.executionMode,
      confidence: normalizeConfidence(frame.confidence),
    },
    reasonCodes: [],
  };
}

export function buildSemanticIntentRequestMetadata(params: {
  frame: SemanticIntentFrame | undefined | null;
  originalQuery: string | null | undefined;
  preprocessing?: SemanticPreprocessingMetadata | undefined | null;
}): SemanticIntentRequestMetadata {
  const mapping = toDomainIntentFrame(params.frame);
  const preprocessing = normalizePreprocessingMetadata(params.preprocessing);
  const reasonCodes = [
    ...mapping.reasonCodes,
    ...(params.preprocessing?.truncated ? ['query_guard_truncated'] : []),
  ];

  if (!params.frame && reasonCodes.length === 0 && !preprocessing) {
    return {};
  }

  const trace: SemanticQueryTrace = {
    originalQuery: params.originalQuery?.trim() ?? '',
    ...(mapping.intentFrame && {
      selectedDomain: mapping.intentFrame.domainId,
      selectedCapability: mapping.intentFrame.capabilityId,
    }),
    evidenceAvailable: false,
    clarificationRequired: false,
    reasonCodes,
  };

  const metadata = {
    ...(mapping.intentFrame && { intentFrame: mapping.intentFrame }),
    ...(preprocessing && preprocessing),
  };

  return {
    ...(Object.keys(metadata).length > 0 && { metadata }),
    semanticQueryTrace: trace,
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
