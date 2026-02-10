import type { AIMetadata } from '@/types/ai-service-types';
import type { DocumentMetadata } from '@/types/rag/rag-types';

// Helper function to convert DocumentMetadata to AIMetadata
export function convertDocumentMetadataToAIMetadata(
  docMeta?: DocumentMetadata
): AIMetadata | undefined {
  if (!docMeta) return undefined;

  const aiMeta: AIMetadata = {};

  // Map known fields with proper types
  if (docMeta.category) aiMeta.category = docMeta.category;
  if (docMeta.tags) aiMeta.tags = docMeta.tags;
  if (docMeta.source) aiMeta.source = docMeta.source;
  if (docMeta.timestamp) aiMeta.timestamp = docMeta.timestamp; // string type is compatible
  if (docMeta.priority !== undefined) aiMeta.importance = docMeta.priority;
  if (docMeta.version) aiMeta.version = docMeta.version;

  // Map other fields, ensuring they match AIMetadata's type constraints
  for (const [key, value] of Object.entries(docMeta)) {
    if (
      [
        'category',
        'tags',
        'source',
        'timestamp',
        'priority',
        'version',
        'title',
        'author',
      ].includes(key)
    ) {
      continue; // Already handled or not needed
    }

    // Only add values that match AIMetadata's allowed types
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value instanceof Date ||
      Array.isArray(value) ||
      (typeof value === 'object' && value !== null && !Array.isArray(value)) ||
      value === undefined
    ) {
      aiMeta[key] = value as
        | string
        | number
        | boolean
        | Date
        | string[]
        | Record<string, unknown>
        | undefined;
    }
  }

  return aiMeta;
}

// Helper function to convert AIMetadata to DocumentMetadata
export function convertAIMetadataToDocumentMetadata(
  aiMeta?: AIMetadata
): DocumentMetadata | undefined {
  if (!aiMeta) return undefined;

  const docMeta: DocumentMetadata = {};

  // Map known fields
  if (aiMeta.category) docMeta.category = aiMeta.category;
  if (aiMeta.tags) docMeta.tags = aiMeta.tags;
  if (aiMeta.source) docMeta.source = aiMeta.source;
  if (aiMeta.timestamp) {
    // Convert Date to string if needed
    docMeta.timestamp =
      aiMeta.timestamp instanceof Date
        ? aiMeta.timestamp.toISOString()
        : aiMeta.timestamp;
  }
  if (aiMeta.importance !== undefined) docMeta.priority = aiMeta.importance;
  if (aiMeta.version) docMeta.version = aiMeta.version;

  // Map other fields
  for (const [key, value] of Object.entries(aiMeta)) {
    if (
      [
        'category',
        'tags',
        'source',
        'timestamp',
        'importance',
        'version',
      ].includes(key)
    ) {
      continue; // Already handled
    }
    docMeta[key] = value;
  }

  return docMeta;
}
