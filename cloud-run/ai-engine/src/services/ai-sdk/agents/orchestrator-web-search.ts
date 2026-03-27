/**
 * Web Search Auto-Detection for Orchestrator
 *
 * @version 5.0.0
 * @updated 2026-02-18 — Fixed check order, added problem-solving keywords
 */

import type { ToolSet } from 'ai';
import { logger } from '../../../lib/logger';

// ============================================================================
// Web Search Auto-Detection
// ============================================================================

/**
 * Keywords that indicate web search might be beneficial
 * These suggest the query needs external/up-to-date information
 */
const WEB_SEARCH_INDICATORS = {
  // External knowledge indicators (always trigger web search)
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
    '해결', '방법', '가이드', '어떻게',
    'how to', 'fix', 'resolve', 'troubleshoot',
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
 *
 * Check order (highest priority first):
 * 1. External indicators → always enable (explicit external need)
 * 2. Technology + problem solving combo → enable (e.g. "kubernetes 문제 해결")
 * 3. Internal-only indicators → disable (pure monitoring query)
 * 4. Default → disable (conservative)
 */
export function shouldEnableWebSearch(query: string): boolean {
  const q = query.toLowerCase();

  // 1. External indicators always take precedence
  const hasExternalIndicator = WEB_SEARCH_INDICATORS.external.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  if (hasExternalIndicator) {
    return true;
  }

  // 2. Technology + problem solving = likely needs web search
  const hasTechIndicator = WEB_SEARCH_INDICATORS.technology.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  const hasProblemSolving = WEB_SEARCH_INDICATORS.problemSolving.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  if (hasTechIndicator && hasProblemSolving) {
    return true;
  }

  // 3. Internal-only: checked AFTER external/tech+problem so compound queries aren't blocked
  const isInternalOnly = INTERNAL_ONLY_INDICATORS.some(keyword =>
    q.includes(keyword.toLowerCase())
  );
  if (isInternalOnly) {
    return false;
  }

  // 4. Default: conservative — don't enable
  return false;
}

/**
 * Resolve web search setting based on request and query
 *
 * - true: force enable (user toggle ON)
 * - 'auto' / undefined: auto-detect based on query keywords
 * - false: completely disable (explicit opt-out, not from UI toggle)
 */
export function resolveWebSearchSetting(
  enableWebSearch: boolean | 'auto' | undefined,
  query: string
): boolean {
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

  const filtered = { ...tools };
  if ('searchWeb' in filtered) {
    delete filtered.searchWeb;
    logger.info('[Tools] searchWeb disabled by enableWebSearch setting');
  }
  return filtered;
}

/**
 * Filter tools based on RAG setting
 * Removes searchKnowledgeBase tool when RAG is disabled
 */
export function filterToolsByRAG(
  tools: ToolSet,
  ragEnabled: boolean
): ToolSet {
  if (ragEnabled) {
    return tools;
  }

  const filtered = { ...tools };
  if ('searchKnowledgeBase' in filtered) {
    delete filtered.searchKnowledgeBase;
    logger.info('[Tools] searchKnowledgeBase disabled by enableRAG setting');
  }
  return filtered;
}
