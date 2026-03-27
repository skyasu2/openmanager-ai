/**
 * 한국 데이터센터 기반 서버 목업 구성
 * 15개 서버 - 단일 온프레미스 사이트(DC1)
 *
 * 서버 존:
 * - AZ1: DC1 Rack Group A
 * - AZ2: DC1 Rack Group B
 * - AZ3: DC1 Rack Group C
 */

import type { Server, ServerEnvironment, ServerRole } from '@/types/server';

export interface MockServerInfo {
  id: string;
  hostname: string;
  type:
    | 'web'
    | 'application'
    | 'database'
    | 'storage'
    | 'backup'
    | 'cache'
    | 'monitoring'
    | 'load-balancer';
  os: string;
  service: string;
  ip: string;
  location: string;
  cpu: {
    cores: number;
    model: string;
  };
  memory: {
    total: number; // GB
  };
  disk: {
    total: number; // GB
  };
  status: 'online' | 'warning' | 'critical';
  description: string;
}

export const mockServers: MockServerInfo[] = [
  // ============================================================================
  // 🌐 웹서버 (Nginx) - 3대
  // ============================================================================
  {
    id: 'web-nginx-dc1-01',
    hostname: 'web-nginx-dc1-01',
    type: 'web',
    os: 'Ubuntu 22.04 LTS',
    service: 'Nginx 1.24.0',
    ip: '10.100.1.11',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 4, model: 'Intel Xeon Gold 6330' },
    memory: { total: 8 },
    disk: { total: 100 },
    status: 'online',
    description: 'DC1 Nginx 웹서버 #1 (AZ1)',
  },
  {
    id: 'web-nginx-dc1-02',
    hostname: 'web-nginx-dc1-02',
    type: 'web',
    os: 'Ubuntu 22.04 LTS',
    service: 'Nginx 1.24.0',
    ip: '10.100.1.12',
    location: 'OnPrem-DC1-AZ2',
    cpu: { cores: 4, model: 'Intel Xeon Gold 6330' },
    memory: { total: 8 },
    disk: { total: 100 },
    status: 'online',
    description: 'DC1 Nginx 웹서버 #2 (AZ2)',
  },
  {
    id: 'web-nginx-dc1-03',
    hostname: 'web-nginx-dc1-03',
    type: 'web',
    os: 'Ubuntu 22.04 LTS',
    service: 'Nginx 1.24.0',
    ip: '10.100.2.11',
    location: 'OnPrem-DC1-AZ3',
    cpu: { cores: 4, model: 'Intel Xeon Silver 4316' },
    memory: { total: 8 },
    disk: { total: 100 },
    status: 'online',
    description: 'DC1 Nginx 웹서버 #3 (AZ3)',
  },

  // ============================================================================
  // 📱 API/WAS 서버 (Spring Boot / Node.js) - 3대
  // ============================================================================
  {
    id: 'api-was-dc1-01',
    hostname: 'api-was-dc1-01',
    type: 'application',
    os: 'Rocky Linux 9.2',
    service: 'Spring Boot 3.2 (JDK 21)',
    ip: '10.100.1.21',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 8, model: 'Intel Xeon Gold 6330' },
    memory: { total: 16 },
    disk: { total: 200 },
    status: 'online',
    description: 'DC1 WAS 서버 #1 (AZ1)',
  },
  {
    id: 'api-was-dc1-02',
    hostname: 'api-was-dc1-02',
    type: 'application',
    os: 'Rocky Linux 9.2',
    service: 'Spring Boot 3.2 (JDK 21)',
    ip: '10.100.1.22',
    location: 'OnPrem-DC1-AZ2',
    cpu: { cores: 8, model: 'Intel Xeon Gold 6330' },
    memory: { total: 16 },
    disk: { total: 200 },
    status: 'online',
    description: 'DC1 WAS 서버 #2 (AZ2)',
  },
  {
    id: 'api-was-dc1-03',
    hostname: 'api-was-dc1-03',
    type: 'application',
    os: 'Rocky Linux 9.2',
    service: 'Spring Boot 3.2 (JDK 21)',
    ip: '10.100.2.21',
    location: 'OnPrem-DC1-AZ3',
    cpu: { cores: 8, model: 'Intel Xeon Silver 4316' },
    memory: { total: 16 },
    disk: { total: 200 },
    status: 'online',
    description: 'DC1 WAS 서버 #3 (AZ3)',
  },

  // ============================================================================
  // 🗄️ 데이터베이스 (MySQL) - 3대
  // ============================================================================
  {
    id: 'db-mysql-dc1-primary',
    hostname: 'db-mysql-dc1-primary',
    type: 'database',
    os: 'Oracle Linux 8.8',
    service: 'MySQL 8.0.35 (Primary)',
    ip: '10.100.1.31',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 16, model: 'Intel Xeon Gold 6348' },
    memory: { total: 64 },
    disk: { total: 1000 },
    status: 'online',
    description: 'DC1 MySQL Primary (AZ1)',
  },
  {
    id: 'db-mysql-dc1-replica',
    hostname: 'db-mysql-dc1-replica',
    type: 'database',
    os: 'Oracle Linux 8.8',
    service: 'MySQL 8.0.35 (Replica)',
    ip: '10.100.1.32',
    location: 'OnPrem-DC1-AZ2',
    cpu: { cores: 16, model: 'Intel Xeon Gold 6348' },
    memory: { total: 64 },
    disk: { total: 1000 },
    status: 'online',
    description: 'DC1 MySQL Replica (AZ2)',
  },
  {
    id: 'db-mysql-dc1-backup',
    hostname: 'db-mysql-dc1-backup',
    type: 'database',
    os: 'Oracle Linux 8.8',
    service: 'MySQL 8.0.35 (Standby)',
    ip: '10.100.2.31',
    location: 'OnPrem-DC1-AZ3',
    cpu: { cores: 16, model: 'Intel Xeon Silver 4316' },
    memory: { total: 64 },
    disk: { total: 1000 },
    status: 'online',
    description: 'DC1 MySQL Standby (AZ3, 비동기 복제)',
  },

  // ============================================================================
  // 💾 캐시 (Redis Cluster) - 2대
  // ============================================================================
  {
    id: 'cache-redis-dc1-01',
    hostname: 'cache-redis-dc1-01',
    type: 'cache',
    os: 'Debian 12',
    service: 'Redis 7.2 Cluster (Master)',
    ip: '10.100.1.41',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 4, model: 'Intel Xeon Gold 6330' },
    memory: { total: 32 },
    disk: { total: 50 },
    status: 'online',
    description: 'DC1 Redis 클러스터 Master (AZ1)',
  },
  {
    id: 'cache-redis-dc1-02',
    hostname: 'cache-redis-dc1-02',
    type: 'cache',
    os: 'Debian 12',
    service: 'Redis 7.2 Cluster (Replica)',
    ip: '10.100.1.42',
    location: 'OnPrem-DC1-AZ2',
    cpu: { cores: 4, model: 'Intel Xeon Gold 6330' },
    memory: { total: 32 },
    disk: { total: 50 },
    status: 'online',
    description: 'DC1 Redis 클러스터 Replica (AZ2)',
  },

  // ============================================================================
  // 📦 스토리지 (NFS / S3 Gateway) - 2대
  // ============================================================================
  {
    id: 'storage-nfs-dc1-01',
    hostname: 'storage-nfs-dc1-01',
    type: 'storage',
    os: 'Rocky Linux 9.2',
    service: 'NFS Server (NetApp ONTAP)',
    ip: '10.100.1.51',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 4, model: 'Intel Xeon Silver 4316' },
    memory: { total: 16 },
    disk: { total: 5000 },
    status: 'online',
    description: 'DC1 NFS 스토리지 서버 (AZ1)',
  },
  {
    id: 'storage-s3gw-dc1-01',
    hostname: 'storage-s3gw-dc1-01',
    type: 'storage',
    os: 'Rocky Linux 9.2',
    service: 'MinIO S3 Gateway',
    ip: '10.100.2.51',
    location: 'OnPrem-DC1-AZ3',
    cpu: { cores: 2, model: 'Intel Xeon Silver 4316' },
    memory: { total: 8 },
    disk: { total: 200 },
    status: 'online',
    description: 'DC1 S3 호환 게이트웨이 (AZ3)',
  },

  // ============================================================================
  // ⚖️ 로드밸런서 (HAProxy) - 2대
  // ============================================================================
  {
    id: 'lb-haproxy-dc1-01',
    hostname: 'lb-haproxy-dc1-01',
    type: 'load-balancer',
    os: 'Ubuntu 22.04 LTS',
    service: 'HAProxy 2.8.3',
    ip: '10.100.1.1',
    location: 'OnPrem-DC1-AZ1',
    cpu: { cores: 4, model: 'Intel Xeon Gold 6330' },
    memory: { total: 8 },
    disk: { total: 50 },
    status: 'online',
    description: 'DC1 HAProxy 로드밸런서 #1 (AZ1)',
  },
  {
    id: 'lb-haproxy-dc1-02',
    hostname: 'lb-haproxy-dc1-02',
    type: 'load-balancer',
    os: 'Ubuntu 22.04 LTS',
    service: 'HAProxy 2.8.3',
    ip: '10.100.2.1',
    location: 'OnPrem-DC1-AZ3',
    cpu: { cores: 4, model: 'Intel Xeon Silver 4316' },
    memory: { total: 8 },
    disk: { total: 50 },
    status: 'online',
    description: 'DC1 HAProxy 로드밸런서 #2 (AZ3)',
  },
];

/**
 * 서버 ID로 서버 정보 조회
 */
export function getServerById(id: string): MockServerInfo | undefined {
  return mockServers.find((server) => server.id === id);
}

/**
 * 타입별 서버 목록 조회
 */
export function getServersByType(
  type: MockServerInfo['type']
): MockServerInfo[] {
  return mockServers.filter((server) => server.type === type);
}

/**
 * 위치별 서버 목록 조회
 */
export function getServersByLocation(location: string): MockServerInfo[] {
  return mockServers.filter((server) => server.location.includes(location));
}

/**
 * 인프라 요약 정보
 */
export function getInfrastructureSummary(): {
  total: number;
  byZone: Record<string, number>;
  byType: Record<string, number>;
} {
  const byZone: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const server of mockServers) {
    const zone = server.location.includes('AZ1')
      ? 'DC1-AZ1'
      : server.location.includes('AZ2')
        ? 'DC1-AZ2'
        : 'DC1-AZ3';
    byZone[zone] = (byZone[zone] || 0) + 1;
    byType[server.type] = (byType[server.type] || 0) + 1;
  }

  return {
    total: mockServers.length,
    byZone,
    byType,
  };
}

/**
 * 🎯 SSOT: Server 타입으로 변환된 Fallback 데이터
 *
 * API 실패 시 사용되는 fallback 서버 목록
 * MockServerInfo를 Server 타입으로 변환하여 반환
 *
 * @returns Server[] - 15개 서버 fallback 데이터
 */
export function getFallbackServers(): Server[] {
  return mockServers.map((info): Server => {
    // MockServerInfo.type은 이미 SSOT ServerRole과 일치 (load-balancer 사용)
    const serverType: ServerRole = info.type;
    const serverEnvironment: ServerEnvironment = 'production';

    return {
      id: info.id,
      name: info.description,
      hostname: `${info.hostname}.internal`,
      type: serverType,
      status: info.status,
      cpu: 30 + Math.random() * 20, // 기본 30-50% 범위
      memory: 40 + Math.random() * 30, // 기본 40-70% 범위
      disk: 20 + Math.random() * 30, // 기본 20-50% 범위
      network: 40 + Math.random() * 30, // 기본 40-70% 범위
      uptime: '99.9%',
      location: info.location,
      lastUpdate: new Date(),
      ip: info.ip,
      os: info.os,
      provider: 'On-Premise',
      environment: serverEnvironment,
      role: serverType,
      specs: {
        cpu_cores: info.cpu.cores,
        memory_gb: info.memory.total,
        disk_gb: info.disk.total,
        network_speed: '1Gbps',
      },
    };
  });
}
