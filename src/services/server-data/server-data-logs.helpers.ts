/** Server type determines which log sources are realistic */
export type ServerType =
  | 'web'
  | 'database'
  | 'cache'
  | 'application'
  | 'loadbalancer'
  | 'storage';

/** Sources that belong to the application layer and legitimately produce OTel traces.
 *  Kernel/system-level sources (kernel, systemd, cron, sshd, rsync) do NOT generate
 *  traceId/spanId in real environments. */
export const APP_LAYER_SOURCES = new Set([
  'java',
  'nginx',
  'haproxy',
  'redis',
  'mysql',
  'postgres',
  'docker',
  'node',
]);

/** Log source availability per server type */
export const SERVER_TYPE_SOURCES: Record<ServerType, Set<string>> = {
  web: new Set([
    'nginx',
    'haproxy',
    'systemd',
    'kernel',
    'docker',
    'cron',
    'sshd',
  ]),
  database: new Set([
    'mysql',
    'postgres',
    'kernel',
    'systemd',
    'docker',
    'cron',
    'sshd',
    'rsync',
  ]),
  cache: new Set(['redis', 'kernel', 'systemd', 'docker', 'cron', 'sshd']),
  application: new Set([
    'java',
    'docker',
    'systemd',
    'kernel',
    'cron',
    'sshd',
    'nginx',
  ]),
  loadbalancer: new Set([
    'haproxy',
    'nginx',
    'kernel',
    'systemd',
    'cron',
    'sshd',
  ]),
  storage: new Set(['kernel', 'systemd', 'docker', 'cron', 'sshd', 'rsync']),
};

/** Check if serverId contains any of the role keywords */
export function matchRole(serverId: string, keywords: string[]): boolean {
  return keywords.some((kw) => serverId.includes(kw));
}

/** Infer ServerType from explicit type or serverId naming convention */
export function inferServerType(
  explicitType: string,
  serverId: string
): ServerType {
  const t = explicitType.toLowerCase();
  if (
    t === 'web' ||
    t === 'database' ||
    t === 'cache' ||
    t === 'application' ||
    t === 'loadbalancer'
  ) {
    return t;
  }

  const id = serverId.toLowerCase();
  if (id.includes('db') || id.includes('mysql') || id.includes('postgres'))
    return 'database';
  if (id.includes('redis') || id.includes('cache') || id.includes('memcache'))
    return 'cache';
  if (
    id.includes('lb') ||
    id.includes('haproxy') ||
    id.includes('loadbalancer')
  )
    return 'loadbalancer';
  if (id.includes('storage') || id.includes('nfs') || id.includes('s3'))
    return 'storage';
  if (id.includes('api') || id.includes('app') || id.includes('worker'))
    return 'application';

  return 'web';
}
