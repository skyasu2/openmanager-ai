import type { ScenarioPoint, Server, ServerType } from './types';

/**
 * 🎯 15개 서버 정의 (SSOT 기반 - 단일 Active 클러스터)
 *
 * DC1 가용 영역:
 * - AZ1: Rack Group A (Primary)
 * - AZ2: Rack Group B (HA Pair)
 * - AZ3: Rack Group C
 *
 * @see src/__mocks__/data/mockServerConfig.ts (SSOT)
 * @see src/data/otel-data/ (OTel 24시간 메트릭)
 */
export const SERVERS: Server[] = [
  // 웹서버 (Nginx) - 3대
  {
    id: 'web-nginx-dc1-01',
    name: 'Nginx #1 (AZ1)',
    type: 'web',
    description: 'DC1 Nginx 웹서버 #1 (Primary)',
  },
  {
    id: 'web-nginx-dc1-02',
    name: 'Nginx #2 (AZ2)',
    type: 'web',
    description: 'DC1 Nginx 웹서버 #2',
  },
  {
    id: 'web-nginx-dc1-03',
    name: 'Nginx #3 (AZ3)',
    type: 'web',
    description: 'DC1 Nginx 웹서버 #3',
  },
  // API/WAS 서버 (Spring Boot) - 3대
  {
    id: 'api-was-dc1-01',
    name: 'WAS #1 (AZ1)',
    type: 'application',
    description: 'DC1 Spring Boot WAS #1 (Primary)',
  },
  {
    id: 'api-was-dc1-02',
    name: 'WAS #2 (AZ2)',
    type: 'application',
    description: 'DC1 Spring Boot WAS #2',
  },
  {
    id: 'api-was-dc1-03',
    name: 'WAS #3 (AZ3)',
    type: 'application',
    description: 'DC1 Spring Boot WAS #3',
  },
  // 데이터베이스 (MySQL) - 3대
  {
    id: 'db-mysql-dc1-primary',
    name: 'MySQL Primary (AZ1)',
    type: 'database',
    description: 'DC1 MySQL Primary (Master)',
  },
  {
    id: 'db-mysql-dc1-replica',
    name: 'MySQL Replica (AZ2)',
    type: 'database',
    description: 'DC1 MySQL Replica (동기 복제)',
  },
  {
    id: 'db-mysql-dc1-backup',
    name: 'MySQL Standby (AZ3)',
    type: 'database',
    description: 'DC1 MySQL Standby (비동기 복제)',
  },
  // 캐시 (Redis) - 2대
  {
    id: 'cache-redis-dc1-01',
    name: 'Redis Master (AZ1)',
    type: 'cache',
    description: 'DC1 Redis 클러스터 Master',
  },
  {
    id: 'cache-redis-dc1-02',
    name: 'Redis Replica (AZ2)',
    type: 'cache',
    description: 'DC1 Redis 클러스터 Replica',
  },
  // 스토리지 - 2대
  {
    id: 'storage-nfs-dc1-01',
    name: 'NFS Storage (AZ1)',
    type: 'storage',
    description: 'DC1 NFS 스토리지 서버',
  },
  {
    id: 'storage-s3gw-dc1-01',
    name: 'S3 Gateway (AZ3)',
    type: 'storage',
    description: 'DC1 S3 호환 게이트웨이',
  },
  // 로드밸런서 (HAProxy) - 2대
  {
    id: 'lb-haproxy-dc1-01',
    name: 'HAProxy #1 (AZ1)',
    type: 'loadbalancer',
    description: 'DC1 HAProxy 로드밸런서 #1 (Primary)',
  },
  {
    id: 'lb-haproxy-dc1-02',
    name: 'HAProxy #2 (AZ3)',
    type: 'loadbalancer',
    description: 'DC1 HAProxy 로드밸런서 #2',
  },
];

/**
 * 정상 메트릭 (기본값) - 서버 타입별 baseline
 * @see src/data/otel-data/ (실제 데이터)
 */
export const normalMetrics: Record<ServerType, ScenarioPoint> = {
  // 웹서버 (Nginx)
  web: {
    cpu: 30,
    memory: 45,
    disk: 25,
    network: 50,
    responseTime: 50,
    errorRate: 0.1,
  },
  // API/WAS 서버 (Spring Boot)
  application: {
    cpu: 45,
    memory: 60,
    disk: 40,
    network: 50,
    responseTime: 100,
    errorRate: 0.2,
  },
  // 데이터베이스 (MySQL)
  database: {
    cpu: 50,
    memory: 70,
    disk: 50,
    network: 45,
    responseTime: 30,
    errorRate: 0.05,
  },
  // 캐시 (Redis)
  cache: {
    cpu: 35,
    memory: 80,
    disk: 20,
    network: 60,
    responseTime: 5,
    errorRate: 0.01,
  },
  // 스토리지 (NFS/S3)
  storage: { cpu: 20, memory: 40, disk: 75, network: 35 },
  // 로드밸런서 (HAProxy)
  loadbalancer: { cpu: 30, memory: 50, disk: 15, network: 70 },
  // Legacy 호환성
  app: {
    cpu: 45,
    memory: 60,
    disk: 40,
    network: 50,
    responseTime: 100,
    errorRate: 0.2,
  },
  api: {
    cpu: 45,
    memory: 60,
    disk: 40,
    network: 50,
    responseTime: 100,
    errorRate: 0.2,
  },
  log: { cpu: 30, memory: 50, disk: 80, network: 40 },
  monitoring: { cpu: 25, memory: 45, disk: 65, network: 30 },
};
