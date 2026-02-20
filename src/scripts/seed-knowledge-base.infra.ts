import type { KnowledgeEntry } from './seed-knowledge-base.types';

export const INFRA_KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    title: 'Docker 컨테이너 트러블슈팅',
    content: `컨테이너 상태 이상 시 점검 가이드:
1. CrashLoopBackOff: 애플리케이션 시작 실패. docker logs로 에러 확인
2. OOMKilled: 메모리 제한 초과. 리소스 제한 상향 또는 메모리 누수 점검
3. ImagePullBackOff: 이미지 경로/인증 확인. docker pull 수동 테스트
4. 네트워크 연결 불가: 포트 바인딩(-p) 확인, 도커 네트워크 inspect
5. 좀비 프로세스: dumb-init 사용 또는 부모 프로세스 확인`,
    category: 'troubleshooting',
    tags: ['docker', 'container', 'kubernetes', 'debug'],
    severity: 'warning',
    related_server_types: ['application', 'web'],
  },
  // [REMOVED] Kubernetes 파드 상태 진단 - Cloud Run 서버리스 사용, K8s 미사용
  // ============================================================================
  // 6. 데이터베이스 심화 (New)
  // ============================================================================
  {
    title: 'PostgreSQL 교착 상태(Deadlock) 해결',
    content: `DB 락 경합 및 데드락 발생 시:
1. pg_stat_activity로 장기 실행 쿼리 및 락 대기 확인
2. 락 점유 프로세스 확인: SELECT pg_blocking_pids(pid)
3. 데드락 유발 쿼리 튜닝 (트랜잭션 순서 통일)
4. 응급 조치: pg_terminate_backend(pid)로 세션 강제 종료
5. 인덱스 누락으로 인한 테이블 락 방지`,
    category: 'troubleshooting',
    tags: ['postgresql', 'database', 'deadlock', 'performance'],
    severity: 'critical',
    related_server_types: ['database'],
  },
  {
    title: 'PostgreSQL 성능 최적화 가이드',
    content: `쿼리 성능 저하 시 최적화 포인트:
1. EXPLAIN ANALYZE로 실행 계획 확인 (Seq Scan 여부)
2. 인덱스 튜닝 (복합 인덱스, 부분 인덱스 활용)
3. 정기적인 VACUUM ANALYZE 실행 (통계 정보 갱신)
4. work_mem, shared_buffers 등 메모리 파라미터 튜닝
5. 커넥션 풀링(PgBouncer) 도입 검토`,
    category: 'best_practice',
    tags: ['postgresql', 'optimization', 'tuning', 'sql'],
    severity: 'info',
    related_server_types: ['database'],
  },
  // ============================================================================
  // 7. 클라우드 플랫폼 가이드 (New)
  // ============================================================================
  {
    title: 'Google Cloud Run 운영 가이드',
    content: `Cloud Run 무서버 환경 운영 팁:
1. Cold Start 대응: min-instances 설정 또는 CPU always allocated
2. 메모리 OOM: 서비스 탭에서 메모리 한도 상향 (최대 32GB)
3. 동시성(Concurrency) 설정: 요청 처리량에 맞춰 조정 (기본 80)
4. 배포 실패 시: 로컬 Docker run으로 에러 재현, 포트(8080) 확인
5. 비용 최적화: 유휴 상태 CPU 할당 해제 옵션 활용`,
    category: 'best_practice',
    tags: ['gcp', 'cloud-run', 'serverless', 'operations'],
    severity: 'info',
    related_server_types: ['application', 'web'],
  },
  {
    title: 'Supabase 스토리지 및 보안 관리',
    content: `Supabase 프로젝트 관리 가이드:
1. Disk IOPS 경고: Compute Add-on 업그레이드 또는 쿼리 최적화
2. RLS(Row Level Security) 정책 필수 적용 (service_role 제외)
3. API Gateway 차단: Kong 로그 확인
4. 백업 복구: Point-in-Time Recovery(PITR) 활성화 검토
5. 커넥션 풀러(Supavisor) 사용 (포트 6543/5432 구분)`,
    category: 'best_practice',
    tags: ['supabase', 'security', 'database', 'cloud'],
    severity: 'info',
    related_server_types: ['database'],
  },
  // ============================================================================
  // 8. 메트릭 해석 가이드 (New)
  // ============================================================================
  {
    title: 'Load Average 해석 가이드',
    content: `Load Average 수치의 의미:
1. 정의: 실행 중이거나 대기 중인 프로세스의 평균 개수
2. 기준: CPU 코어 수보다 높으면 과부하 의심 (1.0 = 1코어 100%)
3. Load > 코어 수: CPU 대기 발생 중
4. 높은 Load, 낮은 CPU 사용률: 디스크 I/O 병목 가능성 높음
5. 확인: uptime, top, vmstat`,
    category: 'best_practice',
    tags: ['metric', 'cpu', 'load-average', 'monitoring'],
    severity: 'info',
    related_server_types: ['all'],
  },
  {
    title: 'I/O Wait (wa) 메트릭 분석',
    content: `CPU wa(Wait I/O)가 높을 때의 의미:
1. 현상: CPU가 디스크 입출력 완료를 기다리는 시간
2. 원인: 느린 디스크, 과도한 로깅, 스왑(Swap) 사용, DB 풀 스캔
3. 진단: iotop으로 디스크 사용토 높은 프로세스 식별
4. 해결: 쿼리 튜닝, 로깅 레벨 조정, 디스크 증설(IOPS)
5. 오해: CPU 부하가 아님, I/O 시스템의 병목임`,
    category: 'best_practice',
    tags: ['metric', 'io', 'disk', 'performance'],
    severity: 'info',
    related_server_types: ['database', 'storage'],
  },
  // ============================================================================
  // 9. 15개 서버 특화 운영 가이드 (2025-12-29)
  // ============================================================================

  // --- Web 서버 (web-prd-01, web-prd-02, web-stg-01) ---
  {
    title: 'Web 서버 (web-prd-01/02, web-stg-01) 장애 대응',
    content: `Web 서버 장애 발생 시 점검 가이드:
1. 서버 상태: web-prd-01, web-prd-02 (Production), web-stg-01 (Staging)
2. CPU 80%+ 급증: Nginx worker 프로세스 확인, 정적 자산 캐싱 점검
3. 메모리 90%+: 프로세스 누수 확인, Nginx 버퍼 설정 점검 (client_body_buffer_size)
4. 응답시간 지연: upstream 연결 확인, 프록시 타임아웃 조정
5. 502 에러: 백엔드 API 서버(api-prd-01/02) 연결 상태 확인
6. 스케일 아웃 기준: CPU 70% 지속 10분 이상 시 web-prd-03 추가 고려`,
    category: 'incident',
    tags: ['web', 'nginx', 'web-prd-01', 'web-prd-02', 'web-stg-01'],
    severity: 'warning',
    related_server_types: ['web'],
  },
  {
    title: 'Web 서버 성능 최적화 가이드',
    content: `Web 서버 성능 튜닝 체크리스트:
1. Nginx worker 설정: worker_processes auto, worker_connections 4096
2. Gzip 압축: text/html, application/json 등 압축 활성화
3. 정적 자산 캐싱: Cache-Control max-age 설정 (1일~1년)
4. Keep-Alive: keepalive_timeout 65, keepalive_requests 1000
5. 버퍼 튜닝: proxy_buffer_size 128k, proxy_buffers 4 256k
6. 모니터링 지표: 동시 연결 수, 요청 처리율, 평균 응답시간`,
    category: 'best_practice',
    tags: ['web', 'nginx', 'performance', 'tuning'],
    severity: 'info',
    related_server_types: ['web'],
  },

  // --- API 서버 (api-prd-01, api-prd-02) ---
  {
    title: 'API 서버 (api-prd-01/02) 장애 대응',
    content: `API 서버 장애 발생 시 점검 가이드:
1. 서버 상태: api-prd-01, api-prd-02 (Active-Active 구성)
2. CPU 급증: 무한루프 또는 N+1 쿼리 패턴 확인, DB 연결 풀 상태 점검
3. 메모리 누수: Node.js/Python 프로세스 힙 덤프 분석
4. 응답시간 급증: 슬로우 쿼리 확인 (db-main-01 연동), 캐시 히트율 점검
5. 5xx 에러 급증: 애플리케이션 로그 확인, 외부 API 의존성 점검
6. 헬스체크 실패: /health 엔드포인트 응답 확인, lb-main-01 설정 점검`,
    category: 'incident',
    tags: ['api', 'backend', 'api-prd-01', 'api-prd-02'],
    severity: 'warning',
    related_server_types: ['api'],
  },
  {
    title: 'API 서버 성능 최적화 가이드',
    content: `API 서버 성능 튜닝 체크리스트:
1. 연결 풀링: DB 커넥션 풀 크기 최적화 (동시 요청 수 기준)
2. 캐싱 전략: cache-redis-01/02와 연동, 핫 데이터 캐싱
3. 비동기 처리: 무거운 작업은 큐로 분리 (backup-server-01 활용)
4. 요청 제한: Rate Limiting 적용 (분당 1000 요청 권장)
5. 로깅 최적화: 프로덕션에서 DEBUG 레벨 비활성화
6. 모니터링 지표: RPS, 평균 응답시간, 에러율, DB 쿼리 시간`,
    category: 'best_practice',
    tags: ['api', 'backend', 'performance', 'tuning'],
    severity: 'info',
    related_server_types: ['api'],
  },

  // --- Database 서버 (db-main-01, db-repl-01) ---
  {
    title: 'Database 서버 (db-main-01, db-repl-01) 장애 대응',
    content: `Database 서버 장애 발생 시 점검 가이드:
1. 서버 구성: db-main-01 (Primary), db-repl-01 (Replica/Read)
2. Replication Lag: db-repl-01 지연 확인, pg_stat_replication 모니터링
3. CPU 급증: 무거운 쿼리 확인 (pg_stat_activity), 인덱스 누락 점검
4. 디스크 I/O 급증: VACUUM 작업 확인, 대량 INSERT/UPDATE 점검
5. 연결 고갈: max_connections 확인, idle 연결 정리 (idle_in_transaction_session_timeout)
6. 페일오버: db-main-01 장애 시 db-repl-01 승격 절차 확인`,
    category: 'incident',
    tags: ['database', 'postgresql', 'db-main-01', 'db-repl-01'],
    severity: 'critical',
    related_server_types: ['database'],
  },
  {
    title: 'Database 복제 및 백업 가이드',
    content: `Database 복제/백업 운영 가이드:
1. Streaming Replication: db-main-01 → db-repl-01 실시간 복제
2. Replication 모니터링: lag_bytes < 1MB, lag_time < 5초 권장
3. 읽기 분산: 조회 쿼리는 db-repl-01로 라우팅 (pgpool/application level)
4. 백업 스케줄: backup-server-01에서 일일 pg_dump, 주간 베이스 백업
5. WAL 아카이빙: 연속 백업을 위한 WAL 파일 보관 (7일)
6. 복구 테스트: 분기별 db-repl-01에서 복구 절차 검증`,
    category: 'best_practice',
    tags: ['database', 'postgresql', 'backup', 'replication'],
    severity: 'info',
    related_server_types: ['database'],
  },

  // --- Cache 서버 (cache-redis-01, cache-redis-02) ---
  {
    title: 'Cache 서버 (cache-redis-01/02) 장애 대응',
    content: `Redis 캐시 서버 장애 발생 시 점검 가이드:
1. 서버 구성: cache-redis-01 (Primary), cache-redis-02 (Replica/Failover)
2. 메모리 부족: INFO memory로 used_memory 확인, maxmemory-policy 점검
3. 연결 거부: maxclients 확인, CLIENT LIST로 연결 상태 점검
4. 슬로우 쿼리: SLOWLOG GET 10으로 느린 명령 확인
5. 복제 지연: INFO replication으로 master_link_status 확인
6. 페일오버: cache-redis-01 장애 시 cache-redis-02 자동 승격 (Sentinel)`,
    category: 'incident',
    tags: ['cache', 'redis', 'cache-redis-01', 'cache-redis-02'],
    severity: 'warning',
    related_server_types: ['cache'],
  },
  {
    title: 'Cache 서버 최적화 및 운영 가이드',
    content: `Redis 캐시 운영 베스트 프랙티스:
1. 메모리 정책: maxmemory-policy allkeys-lru (용량 초과 시 LRU 제거)
2. 키 만료: 모든 캐시 키에 TTL 설정 (세션: 30분, 데이터: 5분)
3. 파이프라이닝: 다중 명령 시 PIPELINE 사용으로 RTT 절감
4. 모니터링: 히트율 > 90% 유지, used_memory < 80% maxmemory
5. 복제 설정: replica-priority로 failover 우선순위 지정
6. 데이터 타입: 적절한 자료구조 선택 (Hash vs String, Sorted Set)`,
    category: 'best_practice',
    tags: ['cache', 'redis', 'optimization', 'memory'],
    severity: 'info',
    related_server_types: ['cache'],
  },

  // --- Storage 서버 (storage-nas-01, storage-s3-gateway) ---
  {
    title: 'Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응',
    content: `Storage 서버 장애 발생 시 점검 가이드:
1. storage-nas-01: 로컬 파일 스토리지 (NFS 마운트)
2. storage-s3-gateway: S3 호환 오브젝트 스토리지 게이트웨이
3. 디스크 용량 부족: df -h로 사용량 확인, 90% 이상 시 정리 필요
4. I/O 지연: iostat -x로 await 시간 확인 (< 20ms 권장)
5. NFS 마운트 문제: showmount -e, mount 상태 확인
6. S3 연결 실패: 네트워크 연결, 인증 토큰 만료 확인`,
    category: 'incident',
    tags: ['storage', 'nas', 's3', 'storage-nas-01', 'storage-s3-gateway'],
    severity: 'warning',
    related_server_types: ['storage'],
  },
  {
    title: 'Storage 용량 관리 및 정리 가이드',
    content: `Storage 용량 관리 베스트 프랙티스:
1. 용량 알림: 70% warning, 85% critical 임계값 설정
2. 로그 로테이션: logrotate 설정으로 오래된 로그 자동 정리
3. 임시 파일: /tmp, 캐시 디렉토리 주기적 정리 (cron)
4. 백업 보존: 일일 7일, 주간 4주, 월간 12개월 정책
5. 용량 예측: 월별 증가율 추적, 3개월 후 용량 예측
6. 아카이빙: 오래된 데이터는 storage-s3-gateway로 이동`,
    category: 'best_practice',
    tags: ['storage', 'disk', 'cleanup', 'archiving'],
    severity: 'info',
    related_server_types: ['storage'],
  },

  // --- Load Balancer (lb-main-01) ---
  {
    title: 'Load Balancer (lb-main-01) 장애 대응',
    content: `Load Balancer 장애 발생 시 점검 가이드:
1. lb-main-01: 메인 로드밸런서 (HAProxy/Nginx)
2. 헬스체크 실패: 백엔드 서버(web-prd-01/02, api-prd-01/02) 상태 확인
3. 연결 타임아웃: 백엔드 응답시간 점검, timeout 설정 조정
4. 트래픽 불균형: 가중치(weight) 설정 확인, 세션 어피니티 점검
5. SSL 인증서 만료: 인증서 유효기간 확인, 갱신 절차 진행
6. 로그 분석: 502/503/504 에러 패턴 확인, 백엔드 원인 파악`,
    category: 'incident',
    tags: ['loadbalancer', 'haproxy', 'nginx', 'lb-main-01'],
    severity: 'critical',
    related_server_types: ['loadbalancer'],
  },
  {
    title: 'Load Balancer 설정 및 최적화 가이드',
    content: `Load Balancer 운영 베스트 프랙티스:
1. 헬스체크: interval 5초, timeout 3초, threshold 3회 설정
2. 알고리즘: Round Robin(기본), Least Connections(API), IP Hash(세션)
3. 연결 제한: 동시 연결 maxconn 설정으로 과부하 방지
4. Keep-Alive: 백엔드 연결 재사용으로 오버헤드 감소
5. 로깅: 요청 로그 활성화, 응답시간 추적
6. 장애 대비: 백엔드 서버 최소 2대 유지, 단일 장애점 제거`,
    category: 'best_practice',
    tags: ['loadbalancer', 'haproxy', 'configuration', 'optimization'],
    severity: 'info',
    related_server_types: ['loadbalancer'],
  },

  // --- Monitor 서버 (monitor-01) ---
  {
    title: 'Monitor 서버 (monitor-01) 운영 가이드',
    content: `모니터링 서버 운영 및 장애 대응:
1. monitor-01: Prometheus, Grafana, Alertmanager 호스팅
2. 메트릭 수집 실패: 각 서버의 exporter 상태 확인 (node_exporter, redis_exporter)
3. 디스크 용량: TSDB 데이터 보존 기간 조정 (기본 15일)
4. 알림 발송 실패: Alertmanager 설정, 슬랙/이메일 연동 점검
5. Grafana 접속 불가: 서비스 상태 확인, 포트 3000 방화벽 점검
6. 고가용성: 필요시 monitor-02 추가 구성 고려`,
    category: 'best_practice',
    tags: ['monitoring', 'prometheus', 'grafana', 'monitor-01'],
    severity: 'info',
    related_server_types: ['monitor'],
  },

  // --- Backup 서버 (backup-server-01) ---
  {
    title: 'Backup 서버 (backup-server-01) 운영 가이드',
    content: `백업 서버 운영 및 복구 가이드:
1. backup-server-01: 일일 백업 작업 수행, 장기 보관
2. 백업 실패 알림: 크론 작업 로그 확인, 디스크 용량 점검
3. 백업 종류: DB(pg_dump), 파일(rsync), 설정(ansible backup)
4. 보존 정책: 일일 7일, 주간 4주, 월간 12개월
5. 복구 테스트: 월 1회 db-repl-01에서 복구 검증
6. 오프사이트: 주간 백업은 storage-s3-gateway로 전송`,
    category: 'best_practice',
    tags: ['backup', 'recovery', 'disaster-recovery', 'backup-server-01'],
    severity: 'info',
    related_server_types: ['backup'],
  },

  // --- Security Gateway (security-gateway-01) ---
  {
    title: 'Security Gateway (security-gateway-01) 운영 가이드',
    content: `보안 게이트웨이 운영 및 점검 가이드:
1. security-gateway-01: WAF, IDS/IPS, VPN 엔드포인트
2. 보안 이벤트 로그: 의심스러운 접근 패턴 모니터링
3. 차단 규칙: 악성 IP 자동 차단, 수동 화이트리스트 관리
4. SSL/TLS: 인증서 만료 30일 전 알림, 자동 갱신 설정
5. VPN 연결: 클라이언트 인증서 관리, 세션 타임아웃 설정
6. 취약점 스캔: 월 1회 내부 네트워크 스캔, 패치 적용`,
    category: 'best_practice',
    tags: ['security', 'waf', 'vpn', 'security-gateway-01'],
    severity: 'info',
    related_server_types: ['security'],
  },
];
