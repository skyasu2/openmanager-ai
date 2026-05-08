import type { CommandRecommendation } from './knowledge-types';

const COMMAND_RECOMMENDATIONS: CommandRecommendation[] = [
  {
    keywords: ['haproxy', 'backend', '백엔드', '상태', '연결'],
    command: 'echo "show stat" | socat - /run/haproxy/admin.sock',
    description: 'HAProxy runtime socket에서 백엔드 서버별 상태와 세션 정보를 CSV로 조회',
  },
  {
    keywords: ['haproxy', '설정', '검증', '체크'],
    command: 'haproxy -c -f /etc/haproxy/haproxy.cfg',
    description: 'HAProxy 설정 파일 문법 검증',
  },
  {
    keywords: ['haproxy', '상태', 'service', 'systemctl'],
    command: 'systemctl status haproxy --no-pager',
    description: 'HAProxy 서비스 상태와 최근 실패 로그 확인',
  },
  {
    keywords: ['nginx', 'access', '액세스', '5xx', '경로', 'path'],
    command:
      "awk '$9 ~ /^5/ {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head",
    description: 'Nginx access log에서 5xx 응답이 많은 요청 경로 상위 목록 확인',
  },
  {
    keywords: ['nginx', 'error', '에러', '로그', '5xx'],
    command: "grep ' 5[0-9][0-9] ' /var/log/nginx/access.log | tail -100",
    description: '최근 Nginx 5xx 요청 원문 확인',
  },
  {
    keywords: ['nfs', 'mount', '마운트', '상태', '확인'],
    command: 'findmnt -t nfs',
    description: '현재 NFS 마운트 상태와 대상 경로 확인',
  },
  {
    keywords: ['nfs', 'export', 'showmount', '서버'],
    command: 'showmount -e <nfs-server>',
    description: 'NFS 서버가 내보내는 export 목록 확인',
  },
  {
    keywords: ['nfs', 'mount', '재마운트', 'remount'],
    command: 'mount -t nfs <nfs-server>:/export/path /mnt/path',
    description: 'NFS export를 지정 경로에 다시 마운트',
  },
  {
    keywords: ['redis', 'bigkeys', '메모리', '큰', '키'],
    command: 'redis-cli --bigkeys',
    description: 'Redis에서 자료형별 큰 키 후보를 샘플링해 확인',
  },
  {
    keywords: ['redis', 'memory', '메모리', 'usage', '키'],
    command: 'redis-cli MEMORY USAGE <key>',
    description: '특정 Redis key의 메모리 사용량 확인',
  },
  {
    keywords: ['mysql', 'processlist', '쿼리', '실행', '느린'],
    command: 'mysql -e "SHOW FULL PROCESSLIST"',
    description: 'MySQL에서 현재 실행 중인 쿼리와 상태 확인',
  },
  {
    keywords: ['mysql', 'slow', '느린', 'slow_query'],
    command: "mysql -e \"SHOW VARIABLES LIKE 'slow_query_log%'\"",
    description: 'MySQL slow query log 활성화 여부와 경로 확인',
  },
  {
    keywords: ['서버', '목록', '조회'],
    command: 'list servers',
    description: '서버 목록 조회',
  },
  {
    keywords: ['상태', '체크', '확인'],
    command: 'status check',
    description: '시스템 상태 점검',
  },
  {
    keywords: ['로그', '분석', '에러'],
    command: 'analyze logs',
    description: '로그 분석',
  },
  {
    keywords: ['재시작', 'restart', '복구'],
    command: 'service restart <service_name>',
    description: '서비스 재시작',
  },
  {
    keywords: ['메모리', '정리', 'cache'],
    command: 'clear cache',
    description: '캐시 정리',
  },
  {
    keywords: ['cpu', '프로세서', '부하'],
    command: 'top -o cpu',
    description: 'CPU 사용량 상위 프로세스 조회',
  },
  {
    keywords: ['디스크', '용량', 'disk'],
    command: 'df -h',
    description: '디스크 사용량 조회',
  },
  {
    keywords: ['네트워크', 'network', '연결'],
    command: 'netstat -an',
    description: '네트워크 연결 상태 조회',
  },
];

const SERVICE_COMMAND_PATTERN =
  /(haproxy|nginx|mysql|redis|nfs|백엔드|액세스\s*로그|access\s*log|5xx|마운트|재마운트|remount|slow\s*query|느린\s*쿼리|bigkeys)/i;
const COMMAND_GUIDANCE_PATTERN =
  /(명령어|커맨드|cli|어떻게|방법|순서|확인하는|확인하고|분석하는|재마운트|remount|큰지\s*확인)/i;
const SERVICE_KEYWORDS = ['haproxy', 'nginx', 'mysql', 'redis', 'nfs'] as const;

export function isServiceCommandGuidanceQuery(query: string): boolean {
  return SERVICE_COMMAND_PATTERN.test(query) && COMMAND_GUIDANCE_PATTERN.test(query);
}

export function extractCommandKeywordsFromQuery(query: string): string[] {
  const normalized = query.toLowerCase();
  const keywords = new Set<string>();

  for (const recommendation of COMMAND_RECOMMENDATIONS) {
    for (const keyword of recommendation.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        keywords.add(keyword);
      }
    }
  }

  if (/5xx|5[0-9][0-9]/i.test(query)) keywords.add('5xx');
  if (/access|액세스/i.test(query)) keywords.add('access');
  if (/backend|백엔드/i.test(query)) keywords.add('backend');
  if (/remount|재마운트/i.test(query)) keywords.add('재마운트');

  return [...keywords];
}

export function getCommandRecommendations(keywords: string[]): CommandRecommendation[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const requestedServices = SERVICE_KEYWORDS.filter((service) =>
    normalizedKeywords.includes(service)
  );
  const candidates =
    requestedServices.length > 0
      ? COMMAND_RECOMMENDATIONS.filter((rec) =>
          rec.keywords.some((keyword) =>
            requestedServices.includes(keyword.toLowerCase() as (typeof SERVICE_KEYWORDS)[number])
          )
        )
      : COMMAND_RECOMMENDATIONS;
  const matched = candidates.filter((rec) =>
    keywords.some((k) =>
      rec.keywords.some(
        (rk) =>
          rk.toLowerCase().includes(k.toLowerCase()) ||
          k.toLowerCase().includes(rk.toLowerCase()),
      ),
    ),
  );

  return matched.length > 0 ? matched : candidates.slice(0, 3);
}

export function buildServiceCommandGuidanceAnswer(query: string): string | null {
  if (!isServiceCommandGuidanceQuery(query)) return null;

  const recommendations = getCommandRecommendations(
    extractCommandKeywordsFromQuery(query)
  ).slice(0, 4);

  if (recommendations.length === 0) return null;

  const lines = ['바로 확인할 명령어는 아래 순서로 실행하면 됩니다.'];
  recommendations.forEach((recommendation, index) => {
    lines.push(
      '',
      `${index + 1}. ${recommendation.description}`,
      '```bash',
      recommendation.command,
      '```'
    );
  });
  lines.push('', '운영 환경의 socket path, export, 로그 경로가 다르면 실제 설정값으로 바꿔 실행하세요.');

  return lines.join('\n');
}
