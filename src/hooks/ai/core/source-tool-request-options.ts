interface SourceToolRequestInput {
  ragEnabled?: boolean;
  webSearchEnabled?: boolean;
}

export interface SourceToolRequestOptions {
  enableRAG?: true;
  enableWebSearch?: true;
}

/**
 * Source controls expose Auto/On semantics.
 *
 * - false/undefined means Auto: omit the request flag and let Cloud Run apply
 *   conservative query-based detection.
 * - true means On: force-enable the corresponding source tool.
 *
 * RAG is intentionally not user-facing in the product UI. This helper still
 * accepts a programmatic RAG override for tests and controlled experiments.
 */
export function buildSourceToolRequestOptions({
  ragEnabled,
  webSearchEnabled,
}: SourceToolRequestInput): SourceToolRequestOptions {
  return {
    ...(ragEnabled === true ? { enableRAG: true as const } : {}),
    ...(webSearchEnabled === true ? { enableWebSearch: true as const } : {}),
  };
}
