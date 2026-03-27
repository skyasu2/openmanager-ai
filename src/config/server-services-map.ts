/**
 * 서버 타입/hostname 패턴 → 기본 서비스 목록 매핑
 *
 * hourly-data JSON에는 services 필드가 없으므로 (Prometheus/node_exporter 포맷),
 * 서버의 hostname과 server_type에서 실행 중인 서비스를 추론합니다.
 *
 * 서비스 status는 서버 메트릭 상태에 따라 동적으로 결정됩니다.
 */

import type { ServiceStatus } from '@/types/common';

type ServiceTemplate = {
  name: string;
  port: number;
  isPrimary?: boolean;
};

type ServerServiceMapping = {
  hostnamePattern: RegExp;
  serverType: string;
  services: ServiceTemplate[];
};

const SERVICE_MAPPINGS: ServerServiceMapping[] = [
  {
    hostnamePattern: /^web-nginx-/,
    serverType: 'web',
    services: [
      { name: 'nginx', port: 80, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^api-was-/,
    serverType: 'application',
    services: [
      { name: 'java-app', port: 8080, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^db-mysql-.*-primary/,
    serverType: 'database',
    services: [
      { name: 'mysql', port: 3306, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^db-mysql-.*-replica/,
    serverType: 'database',
    services: [
      { name: 'mysql', port: 3306, isPrimary: true },
      { name: 'replication-agent', port: 3307 },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^db-mysql-.*-(backup|standby)/,
    serverType: 'database',
    services: [
      { name: 'mysql', port: 3306, isPrimary: true },
      { name: 'replication-agent', port: 3307 },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^cache-redis-/,
    serverType: 'cache',
    services: [
      { name: 'redis', port: 6379, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^storage-nfs-/,
    serverType: 'storage',
    services: [
      { name: 'nfs-server', port: 2049, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^storage-s3gw-/,
    serverType: 'storage',
    services: [
      { name: 'minio', port: 9000, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^lb-haproxy-/,
    serverType: 'loadbalancer',
    services: [
      { name: 'haproxy', port: 443, isPrimary: true },
      { name: 'haproxy-stats', port: 8404 },
      { name: 'node-exporter', port: 9100 },
    ],
  },
  {
    hostnamePattern: /^monitor-/,
    serverType: 'monitoring',
    services: [
      { name: 'prometheus', port: 9090, isPrimary: true },
      { name: 'grafana', port: 3000 },
      { name: 'alertmanager', port: 9093 },
    ],
  },
  {
    hostnamePattern: /^batch-/,
    serverType: 'batch',
    services: [
      { name: 'cron-scheduler', port: 8888, isPrimary: true },
      { name: 'node-exporter', port: 9100 },
    ],
  },
];

/**
 * 서버 메트릭 기반 서비스 status 결정
 */
function resolveServiceStatus(
  template: ServiceTemplate,
  serverStatus: string,
  cpu: number,
  memory: number,
): ServiceStatus {
  if (serverStatus === 'offline') return 'stopped';

  if (template.isPrimary) {
    if (cpu > 95 || memory > 95) return 'error';
    if (cpu > 85 || memory > 85) return 'warning';
  }

  return 'running';
}

/**
 * 서버 hostname/type/메트릭에서 서비스 목록을 추론
 */
export function getServicesForServer(
  hostname: string,
  serverType: string,
  metrics: { cpu: number; memory: number; status: string },
): Array<{ name: string; status: ServiceStatus; port: number }> {
  const hostnameBase = hostname.replace(/\.openmanager\.kr$/, '');

  const mapping =
    SERVICE_MAPPINGS.find((m) => m.hostnamePattern.test(hostnameBase)) ??
    SERVICE_MAPPINGS.find((m) => m.serverType === serverType);

  if (!mapping) {
    return [
      {
        name: 'node-exporter',
        status: metrics.status === 'offline' ? 'stopped' : 'running',
        port: 9100,
      },
    ];
  }

  return mapping.services.map((template) => ({
    name: template.name,
    status: resolveServiceStatus(
      template,
      metrics.status,
      metrics.cpu,
      metrics.memory,
    ),
    port: template.port,
  }));
}
