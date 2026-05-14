/**
 * Server Registry - administrator-entered server identification data
 *
 * Equivalent to:
 *   - Prometheus prometheus.yml static_configs.targets (IP:port)
 *   - Zabbix hosts.interfaces table (IP address per host)
 *   - Nagios objects/hosts.cfg address field
 *
 * hourly-data JSON (Prometheus format) does not contain IP addresses because
 * real Prometheus uses the scrape target address, not a label.
 * This registry provides the missing "target address" for our simulated data.
 *
 * Pattern follows server-services-map.ts: static config, keyed by serverId.
 */

type ServerRegistryEntry = Readonly<{
  serverId: string; // = Prometheus instance hostname part
  ip: string; // = Prometheus target address (static_configs.targets)
}>;

export const SERVER_REGISTRY = [
  // DC1-AZ1/AZ2 subnet (10.100.1.0/24)
  { serverId: 'lb-haproxy-dc1-01', ip: '10.100.1.1' },
  { serverId: 'lb-haproxy-dc1-03', ip: '10.100.1.2' },
  { serverId: 'web-nginx-dc1-01', ip: '10.100.1.11' },
  { serverId: 'web-nginx-dc1-02', ip: '10.100.1.12' },
  { serverId: 'api-was-dc1-01', ip: '10.100.1.21' },
  { serverId: 'api-was-dc1-02', ip: '10.100.1.22' },
  { serverId: 'db-mysql-dc1-primary', ip: '10.100.1.31' },
  { serverId: 'db-mysql-dc1-replica', ip: '10.100.1.32' },
  { serverId: 'cache-redis-dc1-01', ip: '10.100.1.41' },
  { serverId: 'cache-redis-dc1-02', ip: '10.100.1.42' },
  { serverId: 'storage-nfs-dc1-01', ip: '10.100.1.51' },
  { serverId: 'storage-nfs-dc1-02', ip: '10.100.1.52' },
  // DC1-AZ3 subnet (10.100.2.0/24)
  { serverId: 'lb-haproxy-dc1-02', ip: '10.100.2.1' },
  { serverId: 'cache-redis-dc1-03', ip: '10.100.2.42' },
  { serverId: 'web-nginx-dc1-03', ip: '10.100.2.11' },
  { serverId: 'api-was-dc1-03', ip: '10.100.2.21' },
  { serverId: 'db-mysql-dc1-backup', ip: '10.100.2.31' },
  { serverId: 'storage-s3gw-dc1-01', ip: '10.100.2.51' },
] as const satisfies readonly ServerRegistryEntry[];

export type RegisteredServerId = (typeof SERVER_REGISTRY)[number]['serverId'];

const SERVER_ID_ALIASES = {
  'web-server-01': 'web-nginx-dc1-01',
  'web-server-02': 'web-nginx-dc1-02',
  'web-server-03': 'web-nginx-dc1-03',
  'api-server-01': 'api-was-dc1-01',
  'api-server-02': 'api-was-dc1-02',
  'api-server-03': 'api-was-dc1-03',
  'db-server-01': 'db-mysql-dc1-primary',
  'db-server-02': 'db-mysql-dc1-replica',
  'db-server-03': 'db-mysql-dc1-backup',
  'cache-server-01': 'cache-redis-dc1-01',
  'cache-server-02': 'cache-redis-dc1-02',
  'cache-server-03': 'cache-redis-dc1-03',
  'storage-server-01': 'storage-nfs-dc1-01',
  'storage-server-02': 'storage-nfs-dc1-02',
  'storage-server-03': 'storage-s3gw-dc1-01',
  'lb-server-01': 'lb-haproxy-dc1-01',
  'lb-server-02': 'lb-haproxy-dc1-02',
  'lb-server-03': 'lb-haproxy-dc1-03',
} as const satisfies Record<string, RegisteredServerId>;

// O(1) lookup map, built once at module load
const registryMap = new Map<string, string>(
  SERVER_REGISTRY.map((entry) => [entry.serverId, entry.ip])
);
const registryIdSet = new Set<string>(
  SERVER_REGISTRY.map((entry) => entry.serverId)
);
const serverAliasMap = new Map<string, RegisteredServerId>(
  Object.entries(SERVER_ID_ALIASES)
);

function normalizeServerReference(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Look up a server's IP address from the registry.
 * Returns undefined if the server is not registered (no fabrication).
 */
export function getServerIP(serverId: string): string | undefined {
  const registeredServerId = resolveRegisteredServerId(serverId);
  if (!registeredServerId) return undefined;

  return registryMap.get(registeredServerId);
}

export function getRegisteredServerIds(): RegisteredServerId[] {
  return SERVER_REGISTRY.map((entry) => entry.serverId);
}

export function getRegisteredServerAliases(): string[] {
  return Object.keys(SERVER_ID_ALIASES);
}

export function resolveRegisteredServerId(
  value: string
): RegisteredServerId | undefined {
  const normalized = normalizeServerReference(value);
  if (registryIdSet.has(normalized)) {
    return normalized as RegisteredServerId;
  }
  return serverAliasMap.get(normalized);
}
