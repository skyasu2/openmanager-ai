import type {
  ExtractedEntities,
  SemanticIntentFrame,
} from '@/lib/ai/entity-extractor';
import {
  buildSemanticIntentRequestMetadata,
  type DomainIntentFramePayload,
  type SemanticPreprocessingMetadata,
  type SemanticQueryTrace,
} from '@/lib/ai/semantic-intent-frame';

export function buildJobSemanticOptions(params: {
  frame: SemanticIntentFrame | undefined | null;
  preprocessing?: SemanticPreprocessingMetadata | undefined | null;
  originalQuery: string;
}): {
  intentFrame?: DomainIntentFramePayload;
  semanticQueryTrace?: SemanticQueryTrace;
  inputType?: SemanticPreprocessingMetadata['inputType'];
  logExtract?: string;
} {
  const semanticIntentPayload = buildSemanticIntentRequestMetadata({
    frame: params.frame,
    preprocessing: params.preprocessing,
    originalQuery: params.originalQuery,
  });

  return {
    ...(semanticIntentPayload.metadata?.intentFrame && {
      intentFrame: semanticIntentPayload.metadata.intentFrame,
    }),
    ...(semanticIntentPayload.semanticQueryTrace && {
      semanticQueryTrace: semanticIntentPayload.semanticQueryTrace,
    }),
    ...(semanticIntentPayload.metadata?.inputType && {
      inputType: semanticIntentPayload.metadata.inputType,
    }),
    ...(semanticIntentPayload.metadata?.logExtract && {
      logExtract: semanticIntentPayload.metadata.logExtract,
    }),
  };
}

export function toSemanticPreprocessingMetadata(
  entities: Pick<ExtractedEntities, 'inputType' | 'logExtract' | 'truncated'>
): SemanticPreprocessingMetadata | undefined {
  if (!entities.inputType) return undefined;

  return {
    inputType: entities.inputType,
    ...(entities.logExtract && { logExtract: entities.logExtract }),
    ...(entities.truncated && { truncated: true }),
  };
}
