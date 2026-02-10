/**
 * Scenario-based log generation in syslog format.
 *
 * Generates realistic logs from various sources (nginx, docker, kernel,
 * systemd, mysqld, redis, etc.) based on the current scenario and metrics.
 *
 * @see scenario-loader.ts - Main orchestration facade
 */

import type { ScenarioLogEntry } from '@/services/scenario/scenario-types';

/**
 * 📋 시나리오 기반 로그 생성 (실제 syslog 형식)
 *
 * 상용 로그 수집 프로그램과 유사한 형태의 로그를 생성합니다.
 * - syslog 형식: hostname process[pid]: message
 * - 다양한 소스: nginx, docker, kernel, systemd, mysqld, redis 등
 * - 실제 에러 코드 포함
 *
 * @param scenario - 현재 시나리오 설명
 * @param serverMetrics - 서버 메트릭 (cpu, memory, disk, network)
 * @param serverId - 서버 ID (hostname으로 사용)
 * @returns 로그 배열
 */
export function generateScenarioLogs(
  scenario: string,
  serverMetrics: { cpu: number; memory: number; disk: number; network: number },
  serverId: string
): ScenarioLogEntry[] {
  const logs: ScenarioLogEntry[] = [];

  const now = new Date();
  const { cpu, memory, disk, network } = serverMetrics;
  const hostname = serverId.split('.')[0] || serverId;

  // 랜덤 PID 생성 헬퍼
  const pid = (base: number) => base + Math.floor(Math.random() * 1000);

  // 시나리오 키워드 매칭
  const scenarioLower = scenario.toLowerCase();

  // 1. 정상 운영 시나리오
  if (scenarioLower.includes('정상')) {
    logs.push({
      timestamp: new Date(now.getTime() - 30000).toISOString(),
      level: 'info',
      message: `${hostname} systemd[1]: Started Daily apt download activities.`,
      source: 'systemd',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 45000).toISOString(),
      level: 'info',
      message: `${hostname} CRON[${pid(20000)}]: (root) CMD (/usr/lib/apt/apt.systemd.daily install)`,
      source: 'cron',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      level: 'info',
      message: `${hostname} nginx[${pid(1000)}]: 10.0.0.1 - - "GET /health HTTP/1.1" 200 15 "-" "kube-probe/1.28"`,
      source: 'nginx',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 90000).toISOString(),
      level: 'info',
      message: `${hostname} dockerd[${pid(800)}]: time="2026-01-03T10:00:00.000000000Z" level=info msg="Container health status: healthy"`,
      source: 'docker',
    });
  }

  // 2. CPU 과부하 시나리오
  if (
    scenarioLower.includes('cpu') ||
    scenarioLower.includes('과부하') ||
    scenarioLower.includes('api')
  ) {
    logs.push({
      timestamp: new Date(now.getTime() - 15000).toISOString(),
      level: 'error',
      message: `${hostname} kernel: [${pid(50000)}.${pid(100)}] CPU${Math.floor(Math.random() * 8)}: Package temperature above threshold, cpu clock throttled`,
      source: 'kernel',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 30000).toISOString(),
      level: 'error',
      message: `${hostname} nginx[${pid(1000)}]: upstream timed out (110: Connection timed out) while reading response header from upstream`,
      source: 'nginx',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 45000).toISOString(),
      level: 'warn',
      message: `${hostname} java[${pid(5000)}]: GC overhead limit exceeded - heap usage at ${cpu.toFixed(0)}%`,
      source: 'java',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      level: 'warn',
      message: `${hostname} haproxy[${pid(2000)}]: backend api_servers has no server available! (qcur=${Math.floor(cpu * 2)})`,
      source: 'haproxy',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 90000).toISOString(),
      level: 'info',
      message: `${hostname} systemd[1]: node-exporter.service: Watchdog timeout (limit 30s)!`,
      source: 'systemd',
    });
  }

  // 3. 메모리 누수 시나리오
  if (
    scenarioLower.includes('메모리') ||
    scenarioLower.includes('memory') ||
    scenarioLower.includes('oom') ||
    scenarioLower.includes('redis') ||
    scenarioLower.includes('캐시')
  ) {
    logs.push({
      timestamp: new Date(now.getTime() - 10000).toISOString(),
      level: 'error',
      message: `${hostname} kernel: Out of memory: Killed process ${pid(10000)} (java) total-vm:${Math.floor(memory * 100)}kB, anon-rss:${Math.floor(memory * 80)}kB`,
      source: 'kernel',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 25000).toISOString(),
      level: 'error',
      message: `${hostname} redis-server[${pid(3000)}]: # WARNING: Memory usage ${memory.toFixed(0)}% of max. Consider increasing maxmemory.`,
      source: 'redis',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 40000).toISOString(),
      level: 'warn',
      message: `${hostname} dockerd[${pid(800)}]: container ${serverId.substring(0, 12)} OOMKilled=true (memory limit: 2GiB)`,
      source: 'docker',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 55000).toISOString(),
      level: 'warn',
      message: `${hostname} java[${pid(5000)}]: java.lang.OutOfMemoryError: GC overhead limit exceeded`,
      source: 'java',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 80000).toISOString(),
      level: 'info',
      message: `${hostname} java[${pid(5000)}]: [GC (Allocation Failure) ${Math.floor(memory * 50)}K->${Math.floor(memory * 30)}K(${Math.floor(memory * 100)}K), 0.${pid(100)} secs]`,
      source: 'java',
    });
  }

  // 4. 디스크 I/O 시나리오
  if (
    scenarioLower.includes('디스크') ||
    scenarioLower.includes('disk') ||
    scenarioLower.includes('백업') ||
    scenarioLower.includes('i/o')
  ) {
    logs.push({
      timestamp: new Date(now.getTime() - 20000).toISOString(),
      level: 'error',
      message: `${hostname} kernel: [${pid(80000)}.${pid(100)}] EXT4-fs warning (device sda1): ext4_dx_add_entry:2461: Directory (ino: ${pid(100000)}) index full, reach max htree level :2`,
      source: 'kernel',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 35000).toISOString(),
      level: 'error',
      message: `${hostname} mysqld[${pid(4000)}]: [ERROR] InnoDB: Write to file ./ib_logfile0 failed at offset ${pid(1000000)}. ${disk.toFixed(0)}% disk used.`,
      source: 'mysql',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 50000).toISOString(),
      level: 'warn',
      message: `${hostname} rsync[${pid(15000)}]: rsync: write failed on "/backup/db-${hostname}.sql": No space left on device (28)`,
      source: 'rsync',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 70000).toISOString(),
      level: 'info',
      message: `${hostname} systemd[1]: Starting Daily Backup Service...`,
      source: 'systemd',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 120000).toISOString(),
      level: 'info',
      message: `${hostname} pg_dump[${pid(18000)}]: pg_dump: archiving data for table "public.logs" (${Math.floor(disk * 10)}MB)`,
      source: 'postgres',
    });
  }

  // 5. 네트워크 문제 시나리오
  if (
    scenarioLower.includes('네트워크') ||
    scenarioLower.includes('network') ||
    scenarioLower.includes('패킷') ||
    scenarioLower.includes('lb') ||
    scenarioLower.includes('로드밸런서')
  ) {
    logs.push({
      timestamp: new Date(now.getTime() - 12000).toISOString(),
      level: 'error',
      message: `${hostname} kernel: [${pid(90000)}.${pid(100)}] nf_conntrack: nf_conntrack: table full, dropping packet`,
      source: 'kernel',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 28000).toISOString(),
      level: 'error',
      message: `${hostname} nginx[${pid(1000)}]: connect() failed (111: Connection refused) while connecting to upstream`,
      source: 'nginx',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 42000).toISOString(),
      level: 'warn',
      message: `${hostname} haproxy[${pid(2000)}]: Server api_backend/server1 is DOWN, reason: Layer4 timeout, check duration: 5001ms`,
      source: 'haproxy',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 65000).toISOString(),
      level: 'warn',
      message: `${hostname} kernel: [${pid(90000)}.${pid(100)}] TCP: request_sock_TCP: Possible SYN flooding on port 80. Sending cookies.`,
      source: 'kernel',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 95000).toISOString(),
      level: 'info',
      message: `${hostname} sshd[${pid(22000)}]: Received disconnect from 10.0.0.${Math.floor(network / 10)} port ${pid(40000)}: 11: disconnected by user`,
      source: 'sshd',
    });
  }

  // 기본 로그 (시나리오 매칭 없는 경우)
  if (logs.length === 0) {
    logs.push({
      timestamp: new Date(now.getTime() - 30000).toISOString(),
      level: 'info',
      message: `${hostname} systemd[1]: Started Session ${pid(100)} of user root.`,
      source: 'systemd',
    });
    logs.push({
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      level: 'info',
      message: `${hostname} nginx[${pid(1000)}]: 10.0.0.1 - - "GET / HTTP/1.1" 200 612 "-" "curl/7.68.0"`,
      source: 'nginx',
    });
  }

  // 시간순 정렬 (최신 먼저)
  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
