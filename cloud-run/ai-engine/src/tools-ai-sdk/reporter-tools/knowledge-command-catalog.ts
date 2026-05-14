import {
  enrichCommandRecommendation,
  getReadOnlyDiagnosticCommandsFromCatalog,
  type ReadOnlyDiagnosticCommandOptions,
} from './knowledge-command-diagnostics';
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
    keywords: ['redis', 'memory', '메모리', 'info'],
    command: 'redis-cli INFO memory',
    description: 'Redis 메모리 사용량, fragmentation, maxmemory 설정 확인',
  },
  {
    keywords: ['메모리', 'memory', '사용량', '압박'],
    command: 'free -h',
    description: '호스트 메모리 사용량과 swap 상태 확인',
  },
  {
    keywords: ['메모리', 'memory', '프로세스', '압박'],
    command: 'ps aux --sort=-%mem | head -10',
    description: '메모리 사용량이 높은 프로세스 상위 10개 확인',
  },
  {
    keywords: ['메모리', 'memory', 'vmstat', '압박'],
    command: 'vmstat 1 5',
    description: '메모리 압박과 swap in/out 변화 확인',
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
    keywords: ['상태', 'service', 'systemctl', '헬스체크', 'health'],
    command: 'systemctl status <service> --no-pager',
    description: '서비스 상태와 최근 실패 원인 확인',
  },
  {
    keywords: ['로그', 'journalctl', 'service', '에러', '상태'],
    command: 'journalctl -u <service> -n 100 --no-pager',
    description: '서비스별 최근 systemd 로그 100줄 확인',
  },
  {
    keywords: ['cpu', '프로세서', '부하'],
    command: 'top -o cpu',
    description: 'CPU 사용량 상위 프로세스 조회',
  },
  {
    keywords: ['cpu', '프로세스', '부하', '확인'],
    command: 'ps aux --sort=-%cpu | head -10',
    description: 'CPU 사용량이 높은 프로세스 상위 10개 확인',
  },
  {
    keywords: ['디스크', '용량', 'disk', 'capacity', 'space', '파일시스템'],
    command: 'df -h',
    description: '파일시스템별 디스크 사용량 확인',
  },
  {
    keywords: ['디스크', '용량', 'disk', 'capacity', 'space', '확보', '정리', 'cleanup', '대용량'],
    command: 'du -xhd1 / 2>/dev/null | sort -hr | head -20',
    description: '루트 파일시스템에서 큰 디렉터리 후보 상위 20개 확인',
  },
  {
    keywords: ['디스크', '용량', 'disk', 'inode', '아이노드', '확보'],
    command: 'df -ih',
    description: 'inode 고갈 여부 확인',
  },
  {
    keywords: ['디스크', '용량', '로그', 'journalctl', '정리'],
    command: 'journalctl --disk-usage',
    description: 'systemd journal 로그가 차지하는 디스크 사용량 확인',
  },
  {
    keywords: ['디스크', '용량', '로그', 'journalctl', '정리', 'cleanup'],
    command: 'journalctl --vacuum-time=7d',
    description: '최근 7일을 제외한 오래된 journal 로그 정리',
  },
  {
    keywords: ['디스크', '용량', '패키지', 'apt', 'cache', '정리'],
    command: 'apt-get clean',
    description: '패키지 매니저 캐시 정리 후보',
  },
  {
    keywords: ['네트워크', 'network', '연결'],
    command: 'netstat -an',
    description: '네트워크 연결 상태 조회',
  },
  {
    keywords: ['네트워크', 'network', '연결', 'socket'],
    command: 'ss -s',
    description: '소켓 상태 요약 확인',
  },
  {
    keywords: ['네트워크', 'network', '연결', 'socket'],
    command: 'ss -tuna | head -50',
    description: 'TCP/UDP 연결 샘플 확인',
  },
  {
    keywords: ['네트워크', 'network', '인터페이스', 'interface'],
    command: 'ip -s link',
    description: '네트워크 인터페이스별 패킷/에러 카운터 확인',
  },
];

const SERVICE_COMMAND_PATTERN =
  /(haproxy|nginx|mysql|redis|nfs|백엔드|액세스\s*로그|access\s*log|5xx|마운트|재마운트|remount|slow\s*query|느린\s*쿼리|bigkeys)/i;
const RESOURCE_COMMAND_PATTERN =
  /(디스크|disk|용량|capacity|space|filesystem|파일시스템|inode|아이노드|cpu|프로세스|부하|로드|\bload(?:1|5)?\b|메모리|memory|oom)/i;
const COMMAND_GUIDANCE_PATTERN =
  /(명령어|커맨드|cli|어떻게|방법|순서|확인하는|확인하고|확인\s*명령|점검|분석하는|재마운트|remount|큰지\s*확인|확보|정리|cleanup)/i;
const RESOURCE_COMMAND_GUIDANCE_PATTERN =
  /(명령어|커맨드|cli|확인\s*명령|점검\s*명령|용량.*확보|확보.*명령|정리|cleanup)/i;
const LOAD_ADVICE_GUIDANCE_PATTERN =
  /(부하|로드|\bload(?:1|5)?\b).*(방법|대응|조치|해결)|(방법|대응|조치|해결).*(부하|로드|\bload(?:1|5)?\b)/i;
const EXPLICIT_PEAK_TIME_EVIDENCE_PATTERN =
  /(?:피크|peak|max|highest|최고|최대|최고점|최댓값).*(?:시간|시간대|시각|시점|언제|구간)|(?:시간|시간대|시각|시점|언제|구간).*(?:피크|peak|max|highest|최고|최대|최고점|최댓값)/i;
const SERVICE_KEYWORDS = ['haproxy', 'nginx', 'mysql', 'redis', 'nfs'] as const;
const GENERIC_KEYWORDS = new Set([
  '서버',
  '상태',
  '체크',
  '확인',
  '명령어',
  '방법',
  '순서',
  '조회',
]);
const DISK_CAPACITY_COMMANDS = [
  'df -h',
  'du -xhd1 / 2>/dev/null | sort -hr | head -20',
  'df -ih',
  'journalctl --disk-usage',
  'journalctl --vacuum-time=7d',
  'apt-get clean',
] as const;
const CPU_INSPECTION_COMMANDS = [
  'top -o cpu',
  'ps aux --sort=-%cpu | head -10',
] as const;
const MEMORY_INSPECTION_COMMANDS = [
  'free -h',
  'ps aux --sort=-%mem | head -10',
  'vmstat 1 5',
] as const;

export function getReadOnlyDiagnosticCommands({
  metric,
  service,
  limit,
  maxRisk,
}: ReadOnlyDiagnosticCommandOptions): CommandRecommendation[] {
  return getReadOnlyDiagnosticCommandsFromCatalog(COMMAND_RECOMMENDATIONS, {
    metric,
    service,
    limit,
    maxRisk,
  });
}

export function isServiceCommandGuidanceQuery(query: string): boolean {
  if (EXPLICIT_PEAK_TIME_EVIDENCE_PATTERN.test(query)) {
    return false;
  }

  if (SERVICE_COMMAND_PATTERN.test(query)) {
    return COMMAND_GUIDANCE_PATTERN.test(query);
  }

  return (
    RESOURCE_COMMAND_PATTERN.test(query) &&
    (RESOURCE_COMMAND_GUIDANCE_PATTERN.test(query) ||
      LOAD_ADVICE_GUIDANCE_PATTERN.test(query))
  );
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
  if (/capacity|space|용량|확보/i.test(query)) keywords.add('용량');
  if (/cleanup|clean\s*up|정리/i.test(query)) keywords.add('정리');
  if (/inode|아이노드/i.test(query)) keywords.add('inode');
  if (/부하|로드|\bload(?:1|5)?\b/i.test(query)) {
    keywords.add('부하');
    keywords.add('확인');
  }
  if (/방법|대응|조치|해결/i.test(query)) keywords.add('방법');

  return [...keywords];
}

export function getCommandRecommendations(keywords: string[]): CommandRecommendation[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const requestedServices = SERVICE_KEYWORDS.filter((service) =>
    normalizedKeywords.includes(service)
  );
  const byCommand = (commands: readonly string[]) =>
    commands
      .map((command) => COMMAND_RECOMMENDATIONS.find((rec) => rec.command === command))
      .filter((rec): rec is CommandRecommendation => Boolean(rec));

  if (hasDiskCapacityIntent(normalizedKeywords)) {
    return byCommand(DISK_CAPACITY_COMMANDS);
  }

  if (hasCpuInspectionIntent(normalizedKeywords)) {
    return byCommand(CPU_INSPECTION_COMMANDS);
  }

  if (requestedServices.length === 0 && hasMemoryInspectionIntent(normalizedKeywords)) {
    return byCommand(MEMORY_INSPECTION_COMMANDS);
  }

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
      recommendationMatchesKeyword(rec, k, requestedServices),
    ),
  );

  return matched.length > 0 ? matched : candidates.slice(0, 3);
}

function hasAny(keywords: string[], candidates: readonly string[]): boolean {
  return candidates.some((candidate) => keywords.includes(candidate));
}

function hasDiskCapacityIntent(keywords: string[]): boolean {
  return (
    hasAny(keywords, ['디스크', 'disk', '파일시스템', 'filesystem', 'inode', '아이노드']) &&
    hasAny(keywords, ['용량', 'capacity', 'space', '확보', '정리', 'cleanup', '대용량'])
  );
}

function hasCpuInspectionIntent(keywords: string[]): boolean {
  return (
    hasAny(keywords, ['cpu', '프로세서', '부하']) &&
    hasAny(keywords, ['확인', '점검', '명령어', '프로세스', '방법', '대응', '조치', '해결'])
  );
}

function hasMemoryInspectionIntent(keywords: string[]): boolean {
  return hasAny(keywords, ['메모리', 'memory', 'oom', '압박']);
}

function recommendationMatchesKeyword(
  recommendation: CommandRecommendation,
  keyword: string,
  requestedServices: readonly (typeof SERVICE_KEYWORDS)[number][]
): boolean {
  const normalizedKeyword = keyword.toLowerCase();
  if (GENERIC_KEYWORDS.has(normalizedKeyword) && isServiceSpecific(recommendation)) {
    return recommendation.keywords.some((recommendationKeyword) =>
      requestedServices.includes(
        recommendationKeyword.toLowerCase() as (typeof SERVICE_KEYWORDS)[number]
      )
    );
  }

  return recommendation.keywords.some((recommendationKeyword) => {
    const normalizedRecommendationKeyword = recommendationKeyword.toLowerCase();
    return (
      normalizedRecommendationKeyword.includes(normalizedKeyword) ||
      normalizedKeyword.includes(normalizedRecommendationKeyword)
    );
  });
}

function isServiceSpecific(recommendation: CommandRecommendation): boolean {
  return recommendation.keywords.some((keyword) =>
    SERVICE_KEYWORDS.includes(keyword.toLowerCase() as (typeof SERVICE_KEYWORDS)[number])
  );
}

export function buildServiceCommandGuidanceAnswer(query: string): string | null {
  if (!isServiceCommandGuidanceQuery(query)) return null;

  const recommendations = getCommandRecommendations(
    extractCommandKeywordsFromQuery(query)
  )
    .map(enrichCommandRecommendation)
    .slice(0, 6);

  if (recommendations.length === 0) return null;

  const readOnlyRecommendations = recommendations.filter(
    (recommendation) => recommendation.safety === 'read-only'
  );
  const approvalRecommendations = recommendations.filter(
    (recommendation) => recommendation.safety !== 'read-only'
  );
  const lines = [
    '바로 확인할 명령어는 아래 순서로 실행하면 됩니다.',
    '아래는 읽기 전용 진단을 우선한 순서입니다. 재시작, 삭제, sysctl 변경 같은 조치는 결과 확인 후 승인된 절차로만 진행하세요.',
  ];
  readOnlyRecommendations.slice(0, 4).forEach((recommendation, index) => {
    lines.push(
      '',
      `${index + 1}. ${recommendation.description}`,
      '```bash',
      recommendation.command,
      '```'
    );
  });

  if (approvalRecommendations.length > 0) {
    lines.push('', '승인 후 검토할 조치 후보입니다. 결과 확인과 변경 승인 없이 실행하지 마세요.');
    approvalRecommendations.slice(0, 2).forEach((recommendation) => {
      lines.push(
        '',
        `- ${recommendation.description}`,
        '```bash',
        recommendation.command,
        '```'
      );
    });
  }
  lines.push('', '운영 환경의 socket path, export, 로그 경로가 다르면 실제 설정값으로 바꿔 실행하세요.');

  return lines.join('\n');
}
