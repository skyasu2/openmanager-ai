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
  // DC1-AZ1/AZ2 subnet (10.100.1.0/24)
  { serverId: 'lb-haproxy-dc1-01', ip: '10.100.1.1' },
  { serverId: 'web-nginx-dc1-01', ip: '10.100.1.11' },
  { serverId: 'web-nginx-dc1-02', ip: '10.100.1.12' },
  { serverId: 'api-was-dc1-01', ip: '10.100.1.21' },
  { serverId: 'api-was-dc1-02', ip: '10.100.1.22' },
  { serverId: 'db-mysql-dc1-primary', ip: '10.100.1.31' },
  { serverId: 'db-mysql-dc1-replica', ip: '10.100.1.32' },
  { serverId: 'cache-redis-dc1-01', ip: '10.100.1.41' },
  { serverId: 'cache-redis-dc1-02', ip: '10.100.1.42' },
  { serverId: 'storage-nfs-dc1-01', ip: '10.100.1.51' },
  // DC1-AZ3 subnet (10.100.2.0/24)
  { serverId: 'lb-haproxy-dc1-02', ip: '10.100.2.1' },
  { serverId: 'web-nginx-dc1-03', ip: '10.100.2.11' },
  { serverId: 'api-was-dc1-03', ip: '10.100.2.21' },
  { serverId: 'db-mysql-dc1-backup', ip: '10.100.2.31' },
  { serverId: 'storage-s3gw-dc1-01', ip: '10.100.2.51' },
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
