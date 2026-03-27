const DEFAULT_LANGFUSE_BASE_URL = 'https://us.cloud.langfuse.com';

function normalizeBaseUrl(baseUrl?: string): string {
  const trimmed = (baseUrl || DEFAULT_LANGFUSE_BASE_URL).trim();
  return trimmed.replace(/\/+$/, '');
}

export function buildLangfuseDashboardUrl(baseUrl?: string): string {
  return `${normalizeBaseUrl(baseUrl)}/project`;
}

export function buildLangfuseTraceApiUrl(
  traceId: string,
  baseUrl?: string
): string {
  return `${normalizeBaseUrl(baseUrl)}/api/public/traces/${encodeURIComponent(traceId)}`;
}

export function buildLangfuseTraceUrlFromHtmlPath(
  htmlPath?: string | null,
  baseUrl?: string
): string | undefined {
  if (typeof htmlPath !== 'string') {
    return undefined;
  }

  const trimmedPath = htmlPath.trim();
  if (!trimmedPath) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  const normalizedPath = trimmedPath.startsWith('/')
    ? trimmedPath
    : `/${trimmedPath}`;

  return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
}
