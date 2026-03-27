import type { KnowledgeEntry } from './seed-knowledge-base.types';

export const CORE_KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    title: 'CPU 사용량 급증 대응 가이드',
    content: `CPU 사용량이 80% 이상 급증한 경우:
1. top/htop으로 CPU 소비 프로세스 확인
2. 비정상 프로세스 있으면 kill -15로 종료 시도
3. 애플리케이션 로그 확인 (무한루프, 메모리 누수 의심)
4. 필요시 서비스 재시작
5. 반복되면 스케일 아웃 또는 코드 최적화 검토`,
    category: 'incident',
    tags: ['cpu', 'performance', 'scale'],
    severity: 'warning',
    related_server_types: ['web', 'application'],
  },
  {
    title: '메모리 부족 장애 대응',
    content: `메모리 사용량 90% 이상 또는 OOM Killer 발생 시:
1. free -h로 메모리 상태 확인
2. ps aux --sort=-%mem으로 메모리 소비 프로세스 확인
3. 캐시 정리: echo 3 > /proc/sys/vm/drop_caches
4. 메모리 누수 의심 프로세스 재시작
5. 장기적으로 메모리 증설 또는 애플리케이션 최적화`,
    category: 'incident',
    tags: ['memory', 'oom', 'performance'],
    severity: 'critical',
    related_server_types: ['application', 'cache'],
  },
  {
    title: '디스크 용량 부족 대응',
    content: `디스크 사용량 85% 이상 경고 시:
1. df -h로 파티션별 사용량 확인
2. du -sh /*로 대용량 디렉토리 탐색
3. 로그 파일 정리: find /var/log -mtime +7 -delete
4. 임시 파일 정리: rm -rf /tmp/*
5. Docker 정리: docker system prune -a
6. 필요시 디스크 증설 또는 로그 로테이션 설정`,
    category: 'incident',
    tags: ['disk', 'storage', 'cleanup'],
    severity: 'warning',
    related_server_types: ['storage', 'database'],
  },
  {
    title: '네트워크 지연 장애 대응',
    content: `네트워크 지연 또는 패킷 손실 발생 시:
1. ping으로 기본 연결 확인
2. traceroute로 경로 추적
3. netstat -an으로 연결 상태 확인
4. 방화벽 규칙 점검
5. 네트워크 인터페이스 재시작: systemctl restart networking
6. ISP 또는 클라우드 프로바이더 상태 확인`,
    category: 'incident',
    tags: ['network', 'latency', 'connectivity'],
    severity: 'critical',
    related_server_types: ['web', 'loadbalancer'],
  },

  // ============================================================================
  // 트러블슈팅 가이드
  // ============================================================================
  {
    title: '웹 서버 502 에러 해결',
    content: `502 Bad Gateway 에러 발생 시 점검 사항:
1. 백엔드 서비스 실행 상태 확인
2. upstream 서버 연결 테스트
3. 프록시 타임아웃 설정 확인
4. 로드밸런서 헬스체크 상태 확인
5. 백엔드 애플리케이션 로그 분석`,
    category: 'troubleshooting',
    tags: ['http', '502', 'proxy', 'nginx'],
    severity: 'warning',
    related_server_types: ['web', 'loadbalancer'],
  },
  {
    title: '데이터베이스 연결 실패 해결',
    content: `DB 연결 실패 시 점검 사항:
1. DB 서비스 실행 상태: systemctl status postgresql
2. 네트워크 연결: telnet db-host 5432
3. 인증 정보 확인 (pg_hba.conf)
4. 연결 풀 상태 확인
5. 최대 연결 수 초과 여부: show max_connections;
6. 방화벽 규칙 확인`,
    category: 'troubleshooting',
    tags: ['database', 'connection', 'postgresql'],
    severity: 'critical',
    related_server_types: ['database', 'application'],
  },
  {
    title: '캐시 서버 성능 저하 해결',
    content: `Redis/Memcached 성능 저하 시:
1. 메모리 사용량 확인: INFO memory
2. 키 만료 정책 점검
3. 슬로우 로그 확인: SLOWLOG GET 10
4. 연결 수 확인: CLIENT LIST
5. 필요시 캐시 플러시: FLUSHDB (주의!)
6. 클러스터 모드에서 샤드 밸런싱 확인`,
    category: 'troubleshooting',
    tags: ['cache', 'redis', 'performance'],
    severity: 'warning',
    related_server_types: ['cache'],
  },
  // [REMOVED] 로드밸런서 헬스체크 실패 - Vercel/Cloud Run 자동 관리

  // ============================================================================
  // 베스트 프랙티스
  // ============================================================================
  {
    title: '서버 모니터링 베스트 프랙티스',
    content: `효과적인 서버 모니터링 가이드:
1. 핵심 메트릭: CPU, 메모리, 디스크, 네트워크
2. 임계값 설정: 경고 70%, 위험 85%
3. 로그 중앙화: ELK 또는 CloudWatch
4. 알림 설정: 슬랙, 이메일, PagerDuty
5. 대시보드 구성: Grafana 활용
6. 정기 리뷰: 주간 성능 리포트`,
    category: 'best_practice',
    tags: ['monitoring', 'metrics', 'alerting'],
    severity: 'info',
    related_server_types: ['web', 'application', 'database'],
  },
  {
    title: '보안 강화 체크리스트',
    content: `서버 보안 강화 필수 항목:
1. SSH 키 기반 인증 (비밀번호 비활성화)
2. 방화벽 설정 (필요한 포트만 오픈)
3. 정기 보안 패치 적용
4. 불필요한 서비스 비활성화
5. 로그 모니터링 및 침입 탐지
6. 정기 백업 및 복구 테스트`,
    category: 'best_practice',
    tags: ['security', 'hardening', 'compliance'],
    severity: 'info',
    related_server_types: ['web', 'application', 'database'],
  },
  {
    title: '백업 및 복구 전략',
    content: `데이터 보호를 위한 백업 전략:
1. 3-2-1 규칙: 3개 복사본, 2개 미디어, 1개 오프사이트
2. 자동화된 일일 백업
3. 주간 전체 백업, 일일 증분 백업
4. 정기 복구 테스트 (분기별)
5. 암호화된 백업 저장
6. 보존 정책: 일일 7일, 주간 4주, 월간 12개월`,
    category: 'best_practice',
    tags: ['backup', 'recovery', 'disaster-recovery'],
    severity: 'info',
    related_server_types: ['database', 'storage'],
  },

  // ============================================================================
  // CLI 명령어 가이드
  // ============================================================================
  {
    title: '시스템 상태 확인 명령어',
    content: `시스템 상태 점검 필수 명령어:
- uptime: 시스템 가동 시간 및 로드
- free -h: 메모리 사용량
- df -h: 디스크 사용량
- top/htop: 프로세스 모니터링
- netstat -tlnp: 열린 포트 확인
- systemctl status: 서비스 상태`,
    category: 'command',
    tags: ['linux', 'system', 'monitoring'],
    severity: 'info',
    related_server_types: ['web', 'application', 'database'],
  },
  {
    title: '로그 분석 명령어',
    content: `로그 분석을 위한 유용한 명령어:
- tail -f /var/log/syslog: 실시간 로그
- grep -i error /var/log/app.log: 에러 검색
- awk '/ERROR/{print $0}': 패턴 필터링
- journalctl -u nginx: systemd 로그
- zcat app.log.gz | grep error: 압축 로그 검색
- less +F: 대화형 로그 뷰어`,
    category: 'command',
    tags: ['log', 'debugging', 'linux'],
    severity: 'info',
    related_server_types: ['web', 'application'],
  },
  {
    title: '네트워크 진단 명령어',
    content: `네트워크 문제 진단 명령어:
- ping host: 연결 확인
- traceroute host: 경로 추적
- curl -v url: HTTP 요청 상세
- ss -tlnp: 소켓 통계
- iftop: 네트워크 트래픽 모니터링
- tcpdump: 패킷 캡처`,
    category: 'command',
    tags: ['network', 'debugging', 'linux'],
    severity: 'info',
    related_server_types: ['web', 'loadbalancer'],
  },

  // ============================================================================
  // 아키텍처 가이드
  // ============================================================================
  {
    title: '고가용성 아키텍처 설계',
    content: `시스템 고가용성 확보 전략:
1. 다중 가용 영역(AZ) 배포
2. 로드밸런서를 통한 트래픽 분산
3. 데이터베이스 복제 (Primary-Replica)
4. 자동 장애 조치(Failover) 구성
5. 상태 비저장(Stateless) 애플리케이션 설계
6. 정기 장애 대응 훈련`,
    category: 'architecture',
    tags: ['high-availability', 'failover', 'redundancy'],
    severity: 'info',
    related_server_types: ['web', 'database', 'loadbalancer'],
  },
  // [REMOVED] 마이크로서비스 통신 패턴 - 모놀리식 Next.js 구조 사용
  {
    title: 'Vercel/Cloud Run 캐시 전략',
    content: `프로젝트 캐시 전략 (Vercel + Cloud Run):
1. Vercel Edge Cache: stale-while-revalidate 패턴 적용
2. API Route 캐시: Cache-Control 헤더로 제어
3. Cloud Run 메모리 캐시: LRU 캐시 (분석 결과 임시 저장)
4. RAG 쿼리 캐시: 자주 검색되는 쿼리 결과 10분 TTL
5. Supabase 커넥션 풀: Supavisor 활용 (포트 6543)
6. 무효화: 배포 시 자동 또는 /api/cache/optimize 호출`,
    category: 'architecture',
    tags: ['cache', 'vercel', 'cloud-run', 'performance'],
    severity: 'info',
    related_server_types: ['web', 'application'],
  },
];
