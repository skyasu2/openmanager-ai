/**
 * Auto Report — Resolution Commands
 *
 * 서버 역할별 복구 명령어 데이터.
 * formatters.ts에서 분리 — 파일 크기 관리 목적
 */

export const ROLE_RESOLUTION_COMMANDS: Record<
  string,
  Array<{ step: string; command: string; description: string }>
> = {
  web: [
    {
      step: '상태 확인',
      command: 'systemctl status nginx && nginx -t',
      description: 'Nginx 프로세스 상태 및 설정 검증',
    },
    {
      step: '로그 확인',
      command: 'tail -100 /var/log/nginx/error.log',
      description: '최근 에러 로그 확인',
    },
    {
      step: '커넥션 확인',
      command: 'ss -tlnp | grep :80',
      description: '포트 바인딩 및 연결 상태',
    },
    {
      step: '서비스 재시작',
      command: 'systemctl restart nginx',
      description: '설정 변경 적용 또는 복구',
    },
  ],
  application: [
    {
      step: '상태 확인',
      command: 'systemctl status tomcat && curl -s localhost:8080/health',
      description: 'WAS 프로세스 및 헬스체크',
    },
    {
      step: 'JVM 점검',
      command: 'jcmd $(pgrep java) GC.heap_info',
      description: 'JVM 힙 메모리 사용량 확인',
    },
    {
      step: '스레드 덤프',
      command: 'jcmd $(pgrep java) Thread.print > /tmp/thread-dump.txt',
      description: '데드락/병목 스레드 분석',
    },
    {
      step: '서비스 재시작',
      command: 'systemctl restart tomcat',
      description: '메모리 누수 또는 장애 복구',
    },
  ],
  database: [
    {
      step: '상태 확인',
      command: 'mysqladmin -u root status && mysqladmin processlist',
      description: 'MySQL 상태 및 활성 커넥션',
    },
    {
      step: '슬로우 쿼리',
      command:
        'mysql -e "SELECT * FROM sys.statements_with_runtimes_in_95th_percentile LIMIT 10;"',
      description: '95%ile 이상 느린 쿼리 확인',
    },
    {
      step: '디스크 확인',
      command: 'du -sh /var/lib/mysql/ && df -h /var/lib/mysql',
      description: '데이터 디렉토리 용량 확인',
    },
    {
      step: '복제 상태',
      command: 'mysql -e "SHOW REPLICA STATUS\\G"',
      description: 'Replication lag 확인',
    },
  ],
  cache: [
    {
      step: '상태 확인',
      command: 'redis-cli ping && redis-cli info memory',
      description: 'Redis 연결 및 메모리 사용량',
    },
    {
      step: '키 분석',
      command: 'redis-cli --bigkeys --memkeys',
      description: '대용량 키 탐지 (메모리 최적화)',
    },
    {
      step: '슬로우 로그',
      command: 'redis-cli slowlog get 10',
      description: '느린 명령어 확인',
    },
    {
      step: 'AOF 재작성',
      command: 'redis-cli bgrewriteaof',
      description: 'AOF 파일 크기 최적화',
    },
  ],
  storage: [
    {
      step: '마운트 확인',
      command: 'mount | grep nfs && showmount -e localhost',
      description: 'NFS 마운트 상태 및 공유 목록',
    },
    {
      step: 'IOPS 확인',
      command: 'iostat -x 1 3',
      description: '디스크 I/O 성능 측정',
    },
    {
      step: '용량 확인',
      command: 'df -h && du -sh /data/*',
      description: '파티션별 사용량 확인',
    },
    {
      step: '권한 검사',
      command: 'exportfs -v',
      description: 'NFS 내보내기 설정 확인',
    },
  ],
  loadbalancer: [
    {
      step: '상태 확인',
      command:
        'systemctl status haproxy && echo "show stat" | socat /var/run/haproxy.sock stdio',
      description: 'HAProxy 상태 및 백엔드 통계',
    },
    {
      step: '백엔드 헬스',
      command: 'echo "show servers state" | socat /var/run/haproxy.sock stdio',
      description: '백엔드 서버 활성 상태',
    },
    {
      step: '로그 확인',
      command: 'journalctl -u haproxy --since "1 hour ago" | tail -50',
      description: '최근 1시간 HAProxy 로그',
    },
    {
      step: '설정 검증',
      command: 'haproxy -c -f /etc/haproxy/haproxy.cfg',
      description: '설정 파일 문법 검사',
    },
  ],
};
