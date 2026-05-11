import {
  ENTITY_CONFIDENCE_THRESHOLD,
  type SemanticIntentFrame,
} from './entity-extractor';

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
  confidence: number;
}

export interface SemanticQueryTrace {
  originalQuery: string;
  selectedDomain?: string;
  selectedCapability?: string;
  selectedEvidenceProvider?: string;
  evidenceAvailable: boolean;
  clarificationRequired: boolean;
  reasonCodes: SemanticFrameReasonCode[];
}

export interface SemanticIntentFrameMapping {
  intentFrame?: DomainIntentFramePayload;
  reasonCodes: SemanticFrameReasonCode[];
}

export interface SemanticIntentRequestMetadata {
  metadata?: {
    intentFrame: DomainIntentFramePayload;
  };
  semanticQueryTrace?: SemanticQueryTrace;
}

const DOMAIN_ID_BY_SEMANTIC_DOMAIN = {
  monitoring: 'openmanager-monitoring',
} as const;

const CAPABILITY_ID_BY_SEMANTIC_INTENT = {
  metric_peak: 'monitoring.metric_peak',
} as const;

function mapSemanticScope(
  scope: SemanticIntentFrame['scope']
): DomainIntentFramePayload['scope'] {
  return scope === 'server' ? 'entity' : scope;
}

function normalizeConfidence(confidence: number): number {
  const normalized = Math.max(0, Math.min(100, confidence)) / 100;
  return Math.round(normalized * 100) / 100;
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
      confidence: normalizeConfidence(frame.confidence),
    },
    reasonCodes: [],
  };
}

export function buildSemanticIntentRequestMetadata(params: {
  frame: SemanticIntentFrame | undefined | null;
  originalQuery: string | null | undefined;
}): SemanticIntentRequestMetadata {
  const mapping = toDomainIntentFrame(params.frame);

  if (!params.frame && mapping.reasonCodes.length === 0) {
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
    reasonCodes: mapping.reasonCodes,
  };

  return {
    ...(mapping.intentFrame && {
      metadata: {
        intentFrame: mapping.intentFrame,
      },
    }),
    semanticQueryTrace: trace,
  };
}
