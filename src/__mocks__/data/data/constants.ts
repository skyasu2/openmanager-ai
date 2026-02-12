import type { ScenarioPoint, Server, ServerType } from './types';

/**
 * 🎯 15개 서버 정의 (SSOT 기반 - 한국 데이터센터)
 *
 * 서버 존:
 * - ICN: 인천/서울 (메인 데이터센터)
 * - PUS: 부산 (DR 데이터센터)
 *
 * @see src/__mocks__/data/mockServerConfig.ts (SSOT)
 * @see src/data/otel-processed/ (OTel 24시간 메트릭)
 */
export const SERVERS: Server[] = [
  // 웹서버 (Nginx) - 3대
  {
    id: 'web-nginx-icn-01',
    name: '서울 메인 Nginx #1',
    type: 'web',
    description: '서울 메인 Nginx 웹서버 #1 (AZ1)',
  },
  {
    id: 'web-nginx-icn-02',
    name: '서울 Nginx #2',
    type: 'web',
    description: '서울 Nginx 웹서버 #2 (AZ2)',
  },
  {
    id: 'web-nginx-pus-01',
    name: '부산 DR Nginx',
    type: 'web',
    description: '부산 DR Nginx 웹서버',
  },
  // API/WAS 서버 (Spring Boot) - 3대
  {
    id: 'api-was-icn-01',
    name: '서울 메인 WAS #1',
    type: 'app',
    description: '서울 메인 WAS 서버 #1 (AZ1)',
  },
  {
    id: 'api-was-icn-02',
    name: '서울 WAS #2',
    type: 'app',
    description: '서울 WAS 서버 #2 (AZ2)',
  },
  {
    id: 'api-was-pus-01',
    name: '부산 DR WAS',
    type: 'app',
    description: '부산 DR WAS 서버',
  },
  // 데이터베이스 (MySQL) - 3대
  {
    id: 'db-mysql-icn-primary',
    name: '서울 MySQL Primary',
    type: 'database',
    description: '서울 MySQL Primary (Master)',
  },
  {
    id: 'db-mysql-icn-replica',
    name: '서울 MySQL Replica',
    type: 'database',
    description: '서울 MySQL Replica (Slave, AZ2)',
  },
  {
    id: 'db-mysql-pus-dr',
    name: '부산 MySQL DR',
    type: 'database',
    description: '부산 MySQL DR (비동기 복제)',
  },
  // 캐시 (Redis) - 2대
  {
    id: 'cache-redis-icn-01',
    name: '서울 Redis Master',
    type: 'cache',
    description: '서울 Redis 클러스터 Master #1',
  },
  {
    id: 'cache-redis-icn-02',
    name: '서울 Redis Replica',
    type: 'cache',
    description: '서울 Redis 클러스터 Replica (AZ2)',
  },
  // 스토리지 - 2대
  {
    id: 'storage-nfs-icn-01',
    name: '서울 NFS 스토리지',
    type: 'storage',
    description: '서울 NFS 스토리지 서버',
  },
  {
    id: 'storage-s3gw-pus-01',
    name: '부산 S3 Gateway',
    type: 'storage',
    description: '부산 S3 호환 게이트웨이 (DR 백업)',
  },
  // 로드밸런서 (HAProxy) - 2대
  {
    id: 'lb-haproxy-icn-01',
    name: '서울 HAProxy LB',
    type: 'loadbalancer',
    description: '서울 메인 HAProxy 로드밸런서',
  },
  {
    id: 'lb-haproxy-pus-01',
    name: '부산 HAProxy LB',
    type: 'loadbalancer',
    description: '부산 DR HAProxy 로드밸런서',
  },
];

/**
 * 정상 메트릭 (기본값) - 서버 타입별 baseline
 * @see src/data/otel-processed/ (실제 데이터)
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
  app: {
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
