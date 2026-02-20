import type { ArchitectureDiagram } from '../architecture-diagrams.types';

export const INFRASTRUCTURE_TOPOLOGY_ARCHITECTURE: ArchitectureDiagram = {
  id: 'infrastructure-topology',
  title: 'OnPrem DC1 서비스 토폴로지',
  description:
    '15대 Active 서버의 계층 의존성. AZ1/AZ2/AZ3 가용 영역 기반, LB → Web → API → DB/Cache → Storage.',
  layers: [
    {
      title: 'Load Balancer',
      color: 'from-red-500 to-orange-500',
      nodes: [
        {
          id: 'lb-haproxy-dc1-01',
          label: 'HAProxy-01 (AZ1)',
          sublabel: '10.100.1.1 :443',
          type: 'highlight',
          icon: '🔀',
        },
        {
          id: 'lb-haproxy-dc1-02',
          label: 'HAProxy-02 (AZ3)',
          sublabel: '10.100.2.1 :443',
          type: 'highlight',
          icon: '🔀',
        },
      ],
    },
    {
      title: 'Web Tier (Nginx)',
      color: 'from-blue-500 to-cyan-500',
      nodes: [
        {
          id: 'web-nginx-dc1-01',
          label: 'Nginx-01 (AZ1)',
          sublabel: '10.100.1.11 :80',
          type: 'primary',
          icon: '🌐',
        },
        {
          id: 'web-nginx-dc1-02',
          label: 'Nginx-02 (AZ2)',
          sublabel: '10.100.1.12 :80',
          type: 'primary',
          icon: '🌐',
        },
        {
          id: 'web-nginx-dc1-03',
          label: 'Nginx-03 (AZ3)',
          sublabel: '10.100.2.11 :80',
          type: 'primary',
          icon: '🌐',
        },
      ],
    },
    {
      title: 'API Tier (WAS)',
      color: 'from-green-500 to-emerald-500',
      nodes: [
        {
          id: 'api-was-dc1-01',
          label: 'WAS-01 (AZ1)',
          sublabel: '10.100.1.21 :8080',
          type: 'primary',
          icon: '⚙️',
        },
        {
          id: 'api-was-dc1-02',
          label: 'WAS-02 (AZ2)',
          sublabel: '10.100.1.22 :8080',
          type: 'primary',
          icon: '⚙️',
        },
        {
          id: 'api-was-dc1-03',
          label: 'WAS-03 (AZ3)',
          sublabel: '10.100.2.21 :8080',
          type: 'primary',
          icon: '⚙️',
        },
      ],
    },
    {
      title: 'Data Tier',
      color: 'from-purple-500 to-indigo-500',
      nodes: [
        {
          id: 'db-mysql-dc1-primary',
          label: 'MySQL Primary (AZ1)',
          sublabel: '10.100.1.31 :3306',
          type: 'highlight',
          icon: '🗄️',
        },
        {
          id: 'db-mysql-dc1-replica',
          label: 'MySQL Replica (AZ2)',
          sublabel: '10.100.1.32 :3306',
          type: 'secondary',
          icon: '🗄️',
        },
        {
          id: 'db-mysql-dc1-backup',
          label: 'MySQL Standby (AZ3)',
          sublabel: '10.100.2.31 :3306',
          type: 'secondary',
          icon: '🗄️',
        },
        {
          id: 'cache-redis-dc1-01',
          label: 'Redis Master (AZ1)',
          sublabel: '10.100.1.41 :6379',
          type: 'primary',
          icon: '⚡',
        },
        {
          id: 'cache-redis-dc1-02',
          label: 'Redis Replica (AZ2)',
          sublabel: '10.100.1.42 :6379',
          type: 'secondary',
          icon: '⚡',
        },
      ],
    },
    {
      title: 'Storage Tier',
      color: 'from-amber-500 to-yellow-500',
      nodes: [
        {
          id: 'storage-nfs-dc1-01',
          label: 'NFS Storage (AZ1)',
          sublabel: '10.100.1.51 :2049',
          type: 'primary',
          icon: '💾',
        },
        {
          id: 'storage-s3gw-dc1-01',
          label: 'S3 Gateway (AZ3)',
          sublabel: '10.100.2.51 :9000',
          type: 'primary',
          icon: '📦',
        },
      ],
    },
  ],
  connections: [
    // LB -> Web
    { from: 'lb-haproxy-dc1-01', to: 'web-nginx-dc1-01', label: 'L7 Route' },
    { from: 'lb-haproxy-dc1-01', to: 'web-nginx-dc1-02' },
    { from: 'lb-haproxy-dc1-02', to: 'web-nginx-dc1-03', label: 'L7 Route' },
    {
      from: 'lb-haproxy-dc1-02',
      to: 'web-nginx-dc1-01',
      label: 'Failover',
      type: 'dashed',
    },
    { from: 'lb-haproxy-dc1-02', to: 'web-nginx-dc1-02', type: 'dashed' },
    // Web -> API
    {
      from: 'web-nginx-dc1-01',
      to: 'api-was-dc1-01',
      label: 'Reverse Proxy',
    },
    { from: 'web-nginx-dc1-02', to: 'api-was-dc1-02' },
    { from: 'web-nginx-dc1-03', to: 'api-was-dc1-03' },
    // API -> DB
    { from: 'api-was-dc1-01', to: 'db-mysql-dc1-primary', label: 'R/W' },
    { from: 'api-was-dc1-02', to: 'db-mysql-dc1-replica', label: 'Read' },
    {
      from: 'api-was-dc1-03',
      to: 'db-mysql-dc1-backup',
      label: 'Read',
      type: 'dashed',
    },
    // API -> Cache
    {
      from: 'api-was-dc1-01',
      to: 'cache-redis-dc1-01',
      label: 'Session/Cache',
    },
    { from: 'api-was-dc1-02', to: 'cache-redis-dc1-02' },
    {
      from: 'api-was-dc1-03',
      to: 'cache-redis-dc1-02',
      label: 'Cache Fallback',
      type: 'dashed',
    },
    // DB Replication
    {
      from: 'db-mysql-dc1-primary',
      to: 'db-mysql-dc1-replica',
      label: 'Replication',
      type: 'dashed',
    },
    {
      from: 'db-mysql-dc1-primary',
      to: 'db-mysql-dc1-backup',
      label: 'Async Repl.',
      type: 'dashed',
    },
    // API -> Storage
    {
      from: 'api-was-dc1-01',
      to: 'storage-nfs-dc1-01',
      label: 'File I/O',
      type: 'dashed',
    },
    {
      from: 'api-was-dc1-03',
      to: 'storage-s3gw-dc1-01',
      label: 'Object Store',
      type: 'dashed',
    },
  ],
};
