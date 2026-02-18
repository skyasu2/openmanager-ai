/**
 * KB 문서 시드 스크립트
 *
 * 사용법:
 *   npx tsx scripts/seed-knowledge-base.ts              # 새 문서 추가 (임베딩 포함)
 *   npx tsx scripts/seed-knowledge-base.ts --backfill   # NULL 임베딩 문서 보정 + source 이름 통일
 *
 * knowledge_base 테이블에 운영 지식 문서를 추가합니다.
 * 이미 동일 title이 존재하면 스킵합니다.
 * 각 문서에 Mistral mistral-embed (1024d) 임베딩을 생성하여 저장합니다.
 */

import './_env';
import { createClient } from '@supabase/supabase-js';
import { embedText, toVectorString } from '../src/lib/embedding';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수 필요');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

interface KBDocument {
  title: string;
  content: string;
  category: string;
  tags: string[];
  severity: string;
  source: string;
  related_server_types: string[];
}

const SEED_DOCUMENTS: KBDocument[] = [
  // ─── 점진적 메모리 누수 ───
  {
    title: '점진적 메모리 누수 탐지 및 대응 가이드',
    content: `## 점진적 메모리 누수 (Gradual Memory Leak)

### 증상
- 메모리 사용량이 시간 경과에 따라 지속적으로 증가 (시간당 1-5% 상승)
- OOM 이벤트 없이 며칠에 걸쳐 서서히 악화
- GC 빈도 증가, GC 소요 시간 점진적 증가
- 응답 시간이 메모리 증가와 비례하여 느려짐

### OOM과의 차이점
| 구분 | OOM | 점진적 누수 |
|------|-----|------------|
| 속도 | 수분 내 급격한 상승 | 수시간~수일에 걸친 완만한 상승 |
| 감지 | critical alert 즉시 발생 | warning 구간에서 장기 체류 |
| 복구 | 즉시 재시작 필요 | 계획된 재시작 가능 |

### 탐지 방법
1. **24시간 트렌드 분석**: 메모리 사용량의 기울기(slope) 계산
   - 시간당 +2% 이상이면 누수 의심
   - 시간당 +5% 이상이면 누수 확정
2. **GC 메트릭 모니터링**: Full GC 후에도 해제되지 않는 메모리 비율 확인
3. **힙 프로파일링**: Node.js의 경우 --inspect 플래그로 힙 스냅샷 비교

### 대응 기준
- **경고 단계** (slope +2~5%/h): 모니터링 강화, 원인 조사 시작
- **위험 단계** (slope +5%/h 이상): 계획된 rolling restart 수행
- **긴급 단계** (memory >85%): 즉시 재시작, 트래픽 우회

### 일반적 원인
- 이벤트 리스너 미해제
- 캐시 크기 제한 미설정 (unbounded cache)
- 클로저에 의한 의도치 않은 참조 유지
- 전역 변수에 데이터 누적`,
    category: 'troubleshooting',
    tags: ['memory', 'leak', 'gradual', 'gc', 'heap', 'monitoring'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'backend'],
  },

  // ─── 연쇄 장애 ───
  {
    title: '연쇄 장애 (Cascading Failure) 패턴 및 차단 전략',
    content: `## 연쇄 장애 (Cascading Failure)

### 전파 패턴
가장 일반적인 연쇄 장애 경로:

\`\`\`
DB 과부하 → API 타임아웃 증가 → 커넥션 풀 고갈 → Web 502 응답 → 사용자 재시도 → 부하 증폭
\`\`\`

### 서버 타입별 전파 시나리오

1. **DB → API → Web 경로** (가장 흔함)
   - DB slow query → API 응답 지연 → Web 타임아웃
   - 징후: DB CPU 상승 → 10-30분 후 API memory 상승 → Web error rate 증가

2. **Cache → API → Web 경로**
   - Redis/Memcached 장애 → cache miss 폭증 → DB 직접 조회 급증 → DB 과부하
   - 징후: Cache 연결 실패 → DB CPU 급등 → API 응답 시간 10x 증가

3. **네트워크 → 전체 서버 경로**
   - 네트워크 지연 증가 → 모든 서비스 간 통신 지연 → 타임아웃 연쇄
   - 징후: 모든 서버의 network 메트릭 동시 상승

### 탐지 지표
- 2개 이상의 서버 타입에서 **10분 이내** 연속 warning/critical 발생
- DB 서버 alert 발생 후 15분 이내 API 서버 alert 발생
- error rate가 baseline 대비 5배 이상 증가

### 차단점 (Circuit Breaker)
1. **DB 레벨**: slow query 자동 kill (30초 이상), 커넥션 수 제한
2. **API 레벨**: 요청 큐 크기 제한, 타임아웃 축소 (30초→5초)
3. **Web 레벨**: rate limiting, 정적 fallback 페이지
4. **Cache 레벨**: local cache fallback, cache-aside 패턴

### 복구 순서
연쇄 장애 시 반드시 **역순**으로 복구:
1. Web 서버 트래픽 차단 (maintenance 모드)
2. API 서버 큐 비우기
3. DB 정상화 확인
4. Cache 워밍업
5. API 서버 정상화 확인
6. Web 트래픽 점진적 복원 (10% → 50% → 100%)`,
    category: 'incident',
    tags: ['cascading', 'failure', 'circuit-breaker', 'recovery', 'chain'],
    severity: 'critical',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache'],
  },

  // ─── 서버 타입별 정상 범위 ───
  {
    title: '서버 타입별 정상 메트릭 범위 기준 (Baseline)',
    content: `## 서버 타입별 정상 범위 기준

각 서버 타입은 역할에 따라 "정상" 메트릭 범위가 다릅니다.
아래는 운영 환경 기준 baseline입니다.

### Web 서버 (Nginx, Apache, Next.js)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 10-45% | >60% | 정적 파일은 낮고, SSR은 높음 |
| Memory | 30-55% | >70% | SSR 캐시에 따라 변동 |
| Disk | 10-30% | >60% | 로그 로테이션 필수 |
| Network | 20-50% | >65% | 트래픽에 비례 |

### API 서버 (Express, Fastify, Hono)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 15-50% | >65% | JSON 직렬화/역직렬화 비용 |
| Memory | 35-60% | >75% | 요청 처리 중 일시적 상승 정상 |
| Disk | 5-20% | >50% | 로그만 기록 |
| Network | 25-55% | >70% | upstream/downstream 모두 |

### Database 서버 (PostgreSQL, MySQL)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 20-55% | >70% | 복잡한 쿼리 시 스파이크 정상 |
| Memory | 50-75% | >85% | 버퍼 캐시 포함 (높은 게 정상) |
| Disk | 30-60% | >75% | WAL + 데이터 + 인덱스 |
| Network | 10-35% | >50% | 결과셋 크기에 비례 |

> **주의**: DB 서버는 Memory 50-75%가 정상입니다. 버퍼/캐시를 적극 활용하므로 메모리가 낮으면 오히려 비효율적입니다.

### Cache 서버 (Redis, Memcached)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-25% | >40% | 단순 키-값이므로 낮아야 정상 |
| Memory | 40-70% | >80% | eviction 정책에 따라 상한 다름 |
| Disk | 5-15% | >30% | RDB/AOF 백업 시 일시 상승 |
| Network | 30-60% | >75% | 높은 처리량 = 높은 네트워크 |

### Load Balancer / Gateway
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-20% | >35% | L4/L7 프록시만 수행 |
| Memory | 15-35% | >50% | 연결 테이블 크기에 비례 |
| Disk | 5-10% | >20% | 액세스 로그만 |
| Network | 40-70% | >80% | 모든 트래픽 경유 |

### Storage 서버 (NFS, S3 Gateway)
| 메트릭 | 정상 범위 | 주의 | 비고 |
|--------|----------|------|------|
| CPU | 5-15% | >30% | I/O 위주 |
| Memory | 20-40% | >60% | 파일 시스템 캐시 |
| Disk | 40-75% | >85% | 핵심 메트릭, 용량 계획 필수 |
| Network | 20-50% | >65% | 대용량 파일 전송 시 스파이크 |

### 활용 방법
- 각 서버 타입의 baseline과 현재 메트릭을 비교하여 이상 여부 판단
- 글로벌 임계값(80%/90%) 외에 타입별 "주의" 기준 참고
- 시간대별 패턴 고려 (업무시간 vs 야간)`,
    category: 'best_practice',
    tags: ['baseline', 'normal-range', 'server-type', 'threshold', 'metrics'],
    severity: 'info',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache', 'load_balancer', 'storage'],
  },

  // ─── CPU 과부하 진단 ───
  {
    title: 'CPU 사용률 급증 원인 분석 및 대응 가이드',
    content: `## CPU 사용률 급증 (High CPU Utilization)

### 증상
- CPU 사용률이 80% 이상 지속 (5분 이상)
- 응답 시간 급격한 증가 (평소 대비 3x 이상)
- 프로세스 스케줄링 지연으로 전체 시스템 느려짐

### 서버 타입별 주요 원인

**Web 서버**
- SSR 렌더링 과부하 (대규모 페이지 동시 요청)
- 정적 파일 압축(gzip/brotli) 과다
- SSL/TLS 핸드셰이크 폭증

**API 서버**
- JSON 직렬화/역직렬화 대량 처리
- 동기 블로킹 연산 (crypto, 이미지 처리)
- 무한 루프 또는 재귀 호출 버그

**Database 서버**
- Full Table Scan 쿼리 (인덱스 미사용)
- 복잡한 JOIN + 서브쿼리 조합
- VACUUM/ANALYZE 작업 중 부하

### 진단 순서
1. \`top -o %CPU\` — 상위 프로세스 확인
2. \`pidstat -u 1 5\` — 프로세스별 CPU 이력
3. \`perf top\` 또는 \`strace -c -p PID\` — 시스템콜 분석
4. Node.js: \`--prof\` 플래그로 V8 CPU 프로파일링

### 대응 기준
- **경고** (60-80%): 원인 조사 시작, 로드밸런서 트래픽 분산 검토
- **위험** (80-90%): 불필요 프로세스 종료, 트래픽 제한 적용
- **긴급** (>90%, 5분 이상): 인스턴스 수평 확장, 비핵심 배치 중단`,
    category: 'troubleshooting',
    tags: ['cpu', 'high-utilization', 'profiling', 'performance', 'diagnosis'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── 디스크 용량 관리 ───
  {
    title: '디스크 용량 부족 예방 및 긴급 대응 가이드',
    content: `## 디스크 용량 관리 (Disk Space Management)

### 주요 원인 (빈도순)
1. **로그 파일 누적**: 로테이션 미설정 시 수일 내 수십 GB 도달
2. **임시 파일**: /tmp, 빌드 캐시, 업로드 임시 파일
3. **DB WAL/binlog**: PostgreSQL WAL, MySQL binlog 미정리
4. **Docker**: 미사용 이미지/컨테이너/볼륨 누적 (docker system df로 확인)

### 서버 타입별 주의사항
| 타입 | 주요 소비자 | 정리 대상 |
|------|-----------|----------|
| Web | access.log, error.log | logrotate 설정 |
| API | application.log, pm2 logs | pm2 flush, logrotate |
| DB | WAL, pg_xlog, binlog | pg_archivecleanup, PURGE BINARY LOGS |
| Cache | RDB/AOF dump | maxmemory-policy 설정 |

### 진단 명령어
\`\`\`bash
df -h                        # 전체 디스크 사용량
du -sh /var/log/*            # 로그 디렉토리별 크기
find / -size +100M -type f   # 100MB 이상 파일 찾기
lsof +L1                    # 삭제됐지만 열려있는 파일
\`\`\`

### 긴급 대응 (사용률 > 90%)
1. 로그 파일 truncate: \`truncate -s 0 /var/log/app.log\`
2. 오래된 로그 삭제: \`find /var/log -name "*.gz" -mtime +7 -delete\`
3. Docker 정리: \`docker system prune -f\`
4. 패키지 캐시 정리: \`apt clean\` / \`yum clean all\`

### 예방 설정
- logrotate: 7일 보관, 100MB 초과 시 로테이션
- 디스크 75% 경고, 85% 위험 알림 설정
- 주간 자동 정리 cron 설정`,
    category: 'troubleshooting',
    tags: ['disk', 'storage', 'cleanup', 'log-rotation', 'capacity'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'storage'],
  },

  // ─── 네트워크 이슈 ───
  {
    title: '네트워크 지연 및 연결 장애 진단 가이드',
    content: `## 네트워크 문제 진단 (Network Troubleshooting)

### 증상 분류
| 증상 | 가능 원인 | 영향 범위 |
|------|----------|----------|
| 전체 서버 동시 지연 | 스위치/라우터 장애, DNS 장애 | 전체 |
| 특정 서비스 간 지연 | 해당 경로 혼잡, 방화벽 규칙 | 부분 |
| 간헐적 패킷 손실 | NIC 결함, MTU 불일치 | 부분 |
| 연결 거부 | 포트 미개방, 서비스 다운 | 해당 서비스 |

### 진단 순서
1. **연결 확인**: \`ping\`, \`telnet host port\`, \`nc -zv host port\`
2. **경로 추적**: \`traceroute\` / \`mtr\` — 어느 구간에서 지연/손실 발생하는지
3. **DNS 확인**: \`dig\`, \`nslookup\` — DNS 응답 시간, 잘못된 레코드
4. **대역폭 확인**: \`iftop\`, \`nethogs\` — 실시간 트래픽 소비 프로세스
5. **연결 상태**: \`ss -tunapl\` — TIME_WAIT, CLOSE_WAIT 과다 여부

### 자주 발생하는 패턴
- **TIME_WAIT 폭증**: 짧은 수명의 HTTP 연결 반복 → connection pooling 도입
- **CLOSE_WAIT 누적**: 애플리케이션이 소켓 미닫음 → 코드 버그 수정
- **DNS 타임아웃**: 내부 DNS 서버 과부하 → local DNS cache 설정
- **MTU 불일치**: VPN/터널 환경에서 1500 → 1400 조정 필요

### 대응
- **즉시**: 영향받는 서비스 health check 결과 확인
- **단기**: 문제 경로 우회 (DNS, 라우팅 변경)
- **장기**: 모니터링 강화 (SNMP, 패킷 캡처 자동화)`,
    category: 'troubleshooting',
    tags: ['network', 'latency', 'packet-loss', 'dns', 'connection', 'diagnosis'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database', 'cache', 'load_balancer'],
  },

  // ─── 보안 인시던트 ───
  {
    title: '보안 인시던트 초기 대응 체크리스트',
    content: `## 보안 인시던트 대응 (Security Incident Response)

### 인시던트 유형별 초동 대응

**1. 비정상 로그인 시도 감지**
- 동일 IP에서 5분 내 10회 이상 실패
- 대응: IP 차단 (iptables/fail2ban), 계정 잠금, 로그 보존

**2. 의심스러운 프로세스 발견**
- 알 수 없는 프로세스가 CPU/네트워크 과다 사용
- 대응: 프로세스 격리 (kill 전 메모리 덤프), 파일 해시 확인

**3. 데이터 유출 의심**
- 비정상적으로 높은 outbound 트래픽
- 대응: 해당 서버 네트워크 격리, 접근 로그 즉시 보존

### 공통 대응 절차
1. **탐지/확인**: 알림 검증, false positive 배제
2. **격리**: 영향 범위 최소화 (네트워크 분리, 서비스 중단)
3. **증거 보존**: 로그, 메모리 덤프, 디스크 이미지 보존
4. **분석**: 침투 경로, 영향 범위, 유출 데이터 파악
5. **복구**: 패치 적용, 자격 증명 교체, 서비스 복원
6. **사후 검토**: 재발 방지 대책, 프로세스 개선

### 점검 명령어
\`\`\`bash
last -n 50                     # 최근 로그인 이력
lastb -n 50                    # 실패한 로그인 시도
netstat -tunapl | grep ESTAB   # 활성 네트워크 연결
find / -perm -4000 -ls         # SUID 파일 확인
cat /etc/passwd | grep ':0:'   # root 권한 계정 확인
\`\`\`

### 모니터링 서버에서의 징후
- 특정 서버의 network outbound 갑자기 3x 이상 증가
- 새벽 시간대(02:00-05:00) 비정상 CPU 사용
- 알 수 없는 프로세스의 외부 IP 통신`,
    category: 'security',
    tags: ['security', 'incident', 'response', 'intrusion', 'forensics'],
    severity: 'critical',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── 로그 분석 패턴 ───
  {
    title: '서버 로그 분석 패턴 및 이상 징후 탐지',
    content: `## 로그 기반 이상 징후 탐지 (Log Analysis Patterns)

### 핵심 로그 패턴

**1. Error Rate 급증 패턴**
- 정상: error/total < 1%
- 경고: error/total 1-5% (5분 윈도우)
- 위험: error/total > 5% 또는 절대 수 100건/분 이상

**2. 응답 시간 이상 패턴**
- P50 정상인데 P99가 5x 이상: 특정 엔드포인트 또는 DB 쿼리 문제
- 전체 percentile 동시 상승: 리소스 부족 (CPU, Memory)
- 점진적 상승 (시간당 +10%): 메모리 누수 또는 커넥션 고갈

**3. 5xx 응답 분류**
| 코드 | 의미 | 주요 원인 |
|------|------|----------|
| 500 | Internal Server Error | 앱 버그, 미처리 예외 |
| 502 | Bad Gateway | upstream 서버 다운 |
| 503 | Service Unavailable | 과부하, 유지보수 |
| 504 | Gateway Timeout | upstream 응답 지연 |

### 로그 분석 명령어
\`\`\`bash
# 최근 1시간 에러 카운트
grep -c "ERROR" /var/log/app.log

# 5xx 응답 빈도 (Nginx access log)
awk '$9 ~ /^5/ {count++} END {print count}' access.log

# 느린 요청 추출 (1초 이상)
awk '$NF > 1.0 {print}' access.log | tail -20

# 시간대별 에러 분포
grep "ERROR" app.log | awk '{print $1, $2}' | cut -d: -f1,2 | sort | uniq -c
\`\`\`

### 자동 탐지 기준 (모니터링 시스템 연동)
- Error rate 5% 초과 → warning 알림
- 5xx 연속 3회 → critical 알림
- P99 latency baseline 대비 5x → warning 알림
- 로그 볼륨 갑자기 10x 증가 → 조사 필요`,
    category: 'best_practice',
    tags: ['log', 'analysis', 'error-rate', 'latency', 'monitoring', 'pattern'],
    severity: 'info',
    source: 'seed_script',
    related_server_types: ['web', 'api', 'database'],
  },

  // ─── Redis/캐시 운영 ───
  {
    title: 'Redis 및 캐시 서버 운영 이슈 대응 가이드',
    content: `## Redis/캐시 서버 운영 (Cache Operations)

### 주요 이슈 및 대응

**1. 메모리 초과 (maxmemory 도달)**
- 증상: SET 명령 실패, OOM 에러
- 진단: \`redis-cli INFO memory\` → used_memory vs maxmemory
- 대응: eviction policy 확인 (allkeys-lru 권장), TTL 미설정 키 정리
- 예방: maxmemory의 80%에 warning 알림 설정

**2. 연결 수 초과**
- 증상: "max number of clients reached" 에러
- 진단: \`redis-cli CLIENT LIST | wc -l\`
- 대응: 유휴 연결 정리 (\`CLIENT KILL\`), connection pool 설정 검토
- 예방: maxclients 설정 + 커넥션 풀 크기 제한

**3. 느린 명령 (Slow Log)**
- 진단: \`redis-cli SLOWLOG GET 10\`
- 주의 명령: KEYS *, SMEMBERS (대규모 집합), SORT
- 대응: KEYS → SCAN으로 교체, 대규모 자료구조 분할

**4. 캐시 관련 장애 패턴**
- **Cache Stampede**: 인기 키 만료 시 동시 DB 조회 → singleflight/lock 패턴
- **Cache Avalanche**: 대량 키 동시 만료 → TTL에 랜덤 jitter 추가
- **Cache Penetration**: 존재하지 않는 키 반복 조회 → Bloom filter

### 모니터링 지표
| 지표 | 정상 범위 | 경고 |
|------|----------|------|
| hit_rate | >90% | <80% → 캐시 전략 재검토 |
| evicted_keys | 0 | >0 → 메모리 부족 징후 |
| connected_clients | <100 | >500 → 커넥션 누수 의심 |
| mem_fragmentation_ratio | 1.0-1.5 | >2.0 → 재시작 고려 |`,
    category: 'troubleshooting',
    tags: ['redis', 'cache', 'memory', 'eviction', 'connection', 'stampede'],
    severity: 'warning',
    source: 'seed_script',
    related_server_types: ['cache', 'api'],
  },
];

// ============================================================================
// Backfill: NULL 임베딩 보정 + source 이름 통일
// ============================================================================

async function backfillEmbeddings() {
  console.log('🔧 임베딩 백필 시작 — NULL 임베딩 문서 보정 + source 이름 통일...\n');

  // 1. source 이름 통일: seed-script → seed_script
  const { data: wrongSource, error: sourceQueryError } = await supabase
    .from('knowledge_base')
    .select('id, title')
    .eq('source', 'seed-script');

  if (sourceQueryError) {
    console.error('❌ source 조회 실패:', sourceQueryError.message);
  } else if (wrongSource && wrongSource.length > 0) {
    const { error: sourceUpdateError } = await supabase
      .from('knowledge_base')
      .update({ source: 'seed_script' })
      .eq('source', 'seed-script');

    if (sourceUpdateError) {
      console.error('❌ source 통일 실패:', sourceUpdateError.message);
    } else {
      console.log(`✅ source 이름 통일: ${wrongSource.length}건 seed-script → seed_script`);
    }
  } else {
    console.log('ℹ️  source 이름 불일치 없음');
  }

  // 2. NULL 임베딩 문서 조회
  const { data: nullEmbeddingDocs, error: nullQueryError } = await supabase
    .from('knowledge_base')
    .select('id, title, content')
    .is('embedding', null);

  if (nullQueryError) {
    console.error('❌ NULL 임베딩 조회 실패:', nullQueryError.message);
    return;
  }

  if (!nullEmbeddingDocs || nullEmbeddingDocs.length === 0) {
    console.log('✅ NULL 임베딩 문서 없음 — 모든 문서에 임베딩 존재');
    return;
  }

  console.log(`📋 NULL 임베딩 문서 ${nullEmbeddingDocs.length}건 발견\n`);

  let updated = 0;
  let failed = 0;

  for (const doc of nullEmbeddingDocs) {
    try {
      const textToEmbed = `${doc.title}\n\n${doc.content}`.substring(0, 2000);
      const embedding = await embedText(textToEmbed);
      const vectorStr = toVectorString(embedding);

      const { error: updateError } = await supabase
        .from('knowledge_base')
        .update({ embedding: vectorStr })
        .eq('id', doc.id);

      if (updateError) {
        console.error(`  ❌ 임베딩 UPDATE 실패: ${doc.title}`, updateError.message);
        failed++;
      } else {
        console.log(`  ✅ 임베딩 생성: ${doc.title}`);
        updated++;
      }
    } catch (err) {
      console.error(`  ❌ 임베딩 생성 실패: ${doc.title}`, err);
      failed++;
    }
  }

  console.log(`\n📊 백필 결과: ${updated}건 성공, ${failed}건 실패`);
}

// ============================================================================
// Seed: 새 문서 추가 (임베딩 포함)
// ============================================================================

async function seedDocuments() {
  console.log('🌱 KB 시드 시작 (임베딩 포함)...\n');

  let inserted = 0;
  let skipped = 0;

  for (const doc of SEED_DOCUMENTS) {
    // 중복 체크 (title 기준)
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('title', doc.title)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`⏭️  이미 존재: ${doc.title}`);
      skipped++;
      continue;
    }

    // 임베딩 생성 (title + content 결합)
    const textToEmbed = `${doc.title}\n\n${doc.content}`.substring(0, 2000);
    let embeddingStr: string | undefined;
    try {
      const embedding = await embedText(textToEmbed);
      embeddingStr = toVectorString(embedding);
    } catch (err) {
      console.warn(`  ⚠️ 임베딩 생성 실패 (문서는 추가됨): ${doc.title}`, err);
    }

    const insertPayload = embeddingStr
      ? { ...doc, embedding: embeddingStr }
      : doc;

    const { error } = await supabase.from('knowledge_base').insert(insertPayload);

    if (error) {
      console.error(`❌ 실패: ${doc.title}`, error.message);
    } else {
      console.log(`✅ 추가${embeddingStr ? ' (+ 임베딩)' : ''}: ${doc.title}`);
      inserted++;
    }
  }

  // 최종 문서 수 확인
  const { count } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true });

  console.log(`\n📊 결과: ${inserted}건 추가, ${skipped}건 스킵`);
  console.log(`📚 KB 총 문서 수: ${count ?? '확인 불가'}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const isBackfill = process.argv.includes('--backfill');

  if (isBackfill) {
    await backfillEmbeddings();
  } else {
    await seedDocuments();
  }
}

main().catch(console.error);
