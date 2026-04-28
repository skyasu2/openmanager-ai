interface SourceToolRequestInput {
  ragEnabled?: boolean;
  webSearchEnabled?: boolean;
}

export interface SourceToolRequestOptions {
  enableRAG?: true;
  enableWebSearch?: true;
}

/**
 * UI source controls expose Auto/On only.
 *
 * - false/undefined means Auto: omit the request flag and let Cloud Run apply
 *   conservative query-based detection.
 * - true means On: force-enable the corresponding source tool.
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
