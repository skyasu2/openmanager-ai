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

type ServerRegistryEntry = {
  serverId: string; // = Prometheus instance hostname part
  ip: string; // = Prometheus target address (static_configs.targets)
};

const SERVER_REGISTRY: ServerRegistryEntry[] = [
  // Seoul-ICN subnet (10.100.1.0/24)
  { serverId: 'lb-haproxy-icn-01', ip: '10.100.1.1' },
  { serverId: 'web-nginx-icn-01', ip: '10.100.1.11' },
  { serverId: 'web-nginx-icn-02', ip: '10.100.1.12' },
  { serverId: 'api-was-icn-01', ip: '10.100.1.21' },
  { serverId: 'api-was-icn-02', ip: '10.100.1.22' },
  { serverId: 'db-mysql-icn-primary', ip: '10.100.1.31' },
  { serverId: 'db-mysql-icn-replica', ip: '10.100.1.32' },
  { serverId: 'cache-redis-icn-01', ip: '10.100.1.41' },
  { serverId: 'cache-redis-icn-02', ip: '10.100.1.42' },
  { serverId: 'storage-nfs-icn-01', ip: '10.100.1.51' },
  // Busan-PUS subnet (10.100.2.0/24)
  { serverId: 'lb-haproxy-pus-01', ip: '10.100.2.1' },
  { serverId: 'web-nginx-pus-01', ip: '10.100.2.11' },
  { serverId: 'api-was-pus-01', ip: '10.100.2.21' },
  { serverId: 'db-mysql-pus-dr', ip: '10.100.2.31' },
  { serverId: 'storage-s3gw-pus-01', ip: '10.100.2.51' },
];

// O(1) lookup map, built once at module load
const registryMap = new Map<string, string>(
  SERVER_REGISTRY.map((entry) => [entry.serverId, entry.ip])
);

/**
 * Look up a server's IP address from the registry.
 * Returns undefined if the server is not registered (no fabrication).
 */
export function getServerIP(serverId: string): string | undefined {
  return registryMap.get(serverId);
}
