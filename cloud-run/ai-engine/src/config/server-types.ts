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
  db: 'database',
  mysql: 'database',
  postgres: 'database',
  postgresql: 'database',
  mongodb: 'database',
  oracle: 'database',
  mariadb: 'database',
  // Load Balancer variants
  lb: 'loadbalancer',
  haproxy: 'loadbalancer',
  f5: 'loadbalancer',
  elb: 'loadbalancer',
  alb: 'loadbalancer',
  // Web server variants
  nginx: 'web',
  apache: 'web',
  httpd: 'web',
  frontend: 'web',
  // Cache variants
  redis: 'cache',
  memcached: 'cache',
  varnish: 'cache',
  elasticache: 'cache',
  // Storage variants
  nas: 'storage',
  s3: 'storage',
  minio: 'storage',
  nfs: 'storage',
  efs: 'storage',
  // Application variants
  api: 'application',
  app: 'application',
  backend: 'application',
  server: 'application',
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
  return SERVER_TYPE_MAP[normalized] || normalized;
}

/**
 * Check if a keyword is a valid server type
 */
export function isValidServerKeyword(keyword: string): boolean {
  const normalized = keyword.toLowerCase().trim();
  return ALL_SERVER_KEYWORDS.includes(normalized as ServerKeyword) ||
    ['database', 'loadbalancer', 'web', 'cache', 'storage', 'application'].includes(normalized);
}
