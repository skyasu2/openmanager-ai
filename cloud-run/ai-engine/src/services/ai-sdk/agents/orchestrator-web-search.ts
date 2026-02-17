/**
 * Web Search Auto-Detection for Orchestrator
 *
 * @version 4.0.0
 */

import type { ToolSet } from 'ai';

// ============================================================================
// Web Search Auto-Detection
// ============================================================================

/**
 * Keywords that indicate web search might be beneficial
 * These suggest the query needs external/up-to-date information
 */
const WEB_SEARCH_INDICATORS = {
  // External knowledge indicators
  external: [
    '최신', 'latest', '2024', '2025', '2026',
    '뉴스', 'news', '업데이트', 'update',
    'CVE', 'security advisory', '보안 취약점',
  ],
  // Technology/library specific
  technology: [
    'kubernetes', 'k8s', 'docker', 'aws', 'azure', 'gcp',
    'nginx', 'apache', 'redis', 'postgresql', 'mysql',
    'linux', 'ubuntu', 'centos', 'debian',
  ],
  // Problem solving that might need external docs
  problemSolving: [
    '공식 문서', 'documentation', 'docs',
    '버그', 'bug', '이슈', 'issue',
    '릴리스', 'release', '버전', 'version',
  ],
};

/**
 * Keywords that indicate internal data is sufficient (no web search needed)
 */
const INTERNAL_ONLY_INDICATORS = [
  '서버 상태', '서버 목록', 'CPU', '메모리', '디스크',
  '과거 장애', '인시던트', '보고서', '타임라인',
  '우리 서버', '내부', '현재 상태',
  '네트워크', '디비', '캐시', '로드밸런서', '트래픽',
  '응답시간', '장애', '알림', '경고', '위험',
  '서버 현황', '모니터링', '대시보드', '헬스체크',
  '사용률', '임계값', '트렌드',
];

/**
 * Detect if web search would be beneficial for the query
 * Conservative approach to minimize Tavily API calls
 */
export function shouldEnableWebSearch(query: string): boolean {
  const q = query.toLowerCase();

  // Check if query is clearly internal-only
  const isInternalOnly = INTERNAL_ONLY_INDICATORS.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  if (isInternalOnly) {
    return false;
  }

  // Check for external knowledge indicators
  const hasExternalIndicator = WEB_SEARCH_INDICATORS.external.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  if (hasExternalIndicator) {
    return true;
  }

  // Check for technology-specific queries that might need docs
  const hasTechIndicator = WEB_SEARCH_INDICATORS.technology.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  const hasProblemSolving = WEB_SEARCH_INDICATORS.problemSolving.some(keyword =>
    q.includes(keyword.toLowerCase())
  );

  // Technology + problem solving = likely needs web search
  if (hasTechIndicator && hasProblemSolving) {
    return true;
  }

  // Default: don't enable web search (conservative)
  return false;
}

/**
 * Resolve web search setting based on request and query
 */
export function resolveWebSearchSetting(
  enableWebSearch: boolean | 'auto' | undefined,
  query: string
): boolean {
  // Explicit true/false takes precedence
  if (enableWebSearch === true) return true;
  if (enableWebSearch === false) return false;

  // Auto or undefined: detect based on query
  return shouldEnableWebSearch(query);
}

/**
 * Filter tools based on web search setting
 * Removes searchWeb tool when web search is disabled
 */
export function filterToolsByWebSearch(
  tools: ToolSet,
  webSearchEnabled: boolean
): ToolSet {
  if (webSearchEnabled) {
    return tools;
  }

  // Remove searchWeb tool when disabled
  const filtered = { ...tools };
  if ('searchWeb' in filtered) {
    delete filtered.searchWeb;
    console.log('🚫 [Tools] searchWeb disabled by enableWebSearch setting');
  }
  return filtered;
}
