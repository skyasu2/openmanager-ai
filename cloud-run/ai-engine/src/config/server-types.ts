/**
 * Server Type Keywords Constants
 *
 * Centralized server type definitions to ensure consistency between:
 * - Intent classification (supervisor.ts)
 * - Tool descriptions (server-metrics.ts)
 * - Future extensions
 *
 * @version 1.0.0
 * @updated 2026-01-20
 */

// ============================================================================
// Server Type Keywords by Category
// ============================================================================

export const DATABASE_KEYWORDS = [
  'db',
  'database',
  'mysql',
  'postgres',
  'postgresql',
  'mongodb',
  'oracle',
  'mariadb',
] as const;

export const LOADBALANCER_KEYWORDS = [
  'lb',
  'loadbalancer',
  'haproxy',
  'f5',
  'elb',
  'alb',
] as const;

export const WEB_KEYWORDS = [
  'web',
  'nginx',
  'apache',
  'httpd',
  'frontend',
] as const;

export const CACHE_KEYWORDS = [
  'cache',
  'redis',
  'memcached',
  'varnish',
  'elasticache',
] as const;

export const STORAGE_KEYWORDS = [
  'storage',
  'nas',
  's3',
  'minio',
  'nfs',
  'efs',
] as const;

export const APPLICATION_KEYWORDS = [
  'application',
  'api',
  'app',
  'backend',
  'server',
] as const;

// ============================================================================
// Combined Keywords
// ============================================================================

export const ALL_SERVER_KEYWORDS = [
  ...DATABASE_KEYWORDS,
  ...LOADBALANCER_KEYWORDS,
  ...WEB_KEYWORDS,
  ...CACHE_KEYWORDS,
  ...STORAGE_KEYWORDS,
  ...APPLICATION_KEYWORDS,
] as const;

// ============================================================================
// Type Mapping (keyword -> canonical type)
// ============================================================================

export const SERVER_TYPE_MAP: Record<string, string> = {
  // Database variants
  database: 'database',
  db: 'database',
  mysql: 'database',
  postgres: 'database',
  postgresql: 'database',
  mongodb: 'database',
  oracle: 'database',
  mariadb: 'database',
  디비: 'database',
  데이터베이스: 'database',
  db서버: 'database',
  디비서버: 'database',
  데이터베이스서버: 'database',
  // Load Balancer variants
  loadbalancer: 'loadbalancer',
  loadbalancers: 'loadbalancer',
  'load-balancer': 'loadbalancer',
  'load-balancers': 'loadbalancer',
  lb: 'loadbalancer',
  haproxy: 'loadbalancer',
  f5: 'loadbalancer',
  elb: 'loadbalancer',
  alb: 'loadbalancer',
  로드밸런서: 'loadbalancer',
  로드밸런서서버: 'loadbalancer',
  // Web server variants
  web: 'web',
  nginx: 'web',
  apache: 'web',
  httpd: 'web',
  frontend: 'web',
  웹: 'web',
  웹서버: 'web',
  // Cache variants
  cache: 'cache',
  redis: 'cache',
  memcached: 'cache',
  varnish: 'cache',
  elasticache: 'cache',
  캐시: 'cache',
  캐시서버: 'cache',
  레디스: 'cache',
  레디스서버: 'cache',
  // Storage variants
  storage: 'storage',
  nas: 'storage',
  s3: 'storage',
  minio: 'storage',
  nfs: 'storage',
  efs: 'storage',
  스토리지: 'storage',
  저장소: 'storage',
  스토리지서버: 'storage',
  저장소서버: 'storage',
  // Application variants
  application: 'application',
  was: 'application',
  was서버: 'application',
  api: 'application',
  app: 'application',
  backend: 'application',
  server: 'application',
  애플리케이션: 'application',
  애플리케이션서버: 'application',
};

// ============================================================================
// Regex Patterns (pre-built for performance)
// ============================================================================

/**
 * Pattern for matching server group keywords (case-insensitive)
 * Used in: supervisor.ts classifyIntent()
 */
export const SERVER_GROUP_PATTERN = new RegExp(
  `(${ALL_SERVER_KEYWORDS.join('|')}|웹|캐시|스토리지)`,
  'i'
);

/**
 * Pattern for matching filter/sort keywords (case-insensitive)
 * Used in: supervisor.ts classifyIntent()
 */
export const FILTER_PATTERN = /(이상|초과|미만|이하|\d+%|높은|낮은|순|정렬|warning|critical|online|상위|top)/i;

// ============================================================================
// Description Strings (for tool descriptions)
// ============================================================================

export const SERVER_TYPE_DESCRIPTIONS = {
  database: `database (또는 ${DATABASE_KEYWORDS.slice(1).join(', ')})`,
  loadbalancer: `loadbalancer (또는 ${LOADBALANCER_KEYWORDS.slice(1).join(', ')})`,
  web: `web (또는 ${WEB_KEYWORDS.slice(1).join(', ')})`,
  cache: `cache (또는 ${CACHE_KEYWORDS.slice(1).join(', ')})`,
  storage: `storage (또는 ${STORAGE_KEYWORDS.slice(1).join(', ')})`,
  application: `application (또는 ${APPLICATION_KEYWORDS.slice(1).join(', ')})`,
};

/**
 * Full description for tool inputSchema
 */
export const SERVER_GROUP_INPUT_DESCRIPTION = `서버 그룹/타입. 지원: ${ALL_SERVER_KEYWORDS.join(', ')}`;

/**
 * Formatted list for tool description
 */
export const SERVER_GROUP_DESCRIPTION_LIST = Object.entries(SERVER_TYPE_DESCRIPTIONS)
  .map(([type, desc]) => `- ${type}: ${desc.replace(`${type} (또는 `, '').replace(')', '')}`)
  .join('\n');

// ============================================================================
// Type Definitions
// ============================================================================

export type ServerKeyword = (typeof ALL_SERVER_KEYWORDS)[number];
export type CanonicalServerType = 'database' | 'loadbalancer' | 'web' | 'cache' | 'storage' | 'application';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize a server group input to canonical type
 */
export function normalizeServerType(input: string): string {
  const normalized = input.toLowerCase().trim();
  const compact = normalized.replace(/[\s_-]+/g, '');
  const withoutGroupSuffix = compact.replace(
    /(?:서버|server|그룹|group|만)$/i,
    ''
  );

  return (
    SERVER_TYPE_MAP[normalized] ||
    SERVER_TYPE_MAP[compact] ||
    SERVER_TYPE_MAP[withoutGroupSuffix] ||
    normalized
  );
}

/**
 * Check if a keyword is a valid server type
 */
export function isValidServerKeyword(keyword: string): boolean {
  const normalized = keyword.toLowerCase().trim();
  return ALL_SERVER_KEYWORDS.includes(normalized as ServerKeyword) ||
    ['database', 'loadbalancer', 'web', 'cache', 'storage', 'application'].includes(normalized);
}
