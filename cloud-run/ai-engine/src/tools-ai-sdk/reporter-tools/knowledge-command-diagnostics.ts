import type {
  CommandRecommendation,
  CommandSafety,
  DiagnosticMetric,
  OperationalRisk,
} from './knowledge-types';

const SERVICE_KEYWORDS = ['haproxy', 'nginx', 'mysql', 'redis', 'nfs'] as const;
const METRIC_DIAGNOSTIC_COMMANDS: Record<DiagnosticMetric, readonly string[]> = {
  cpu: ['top -o cpu', 'ps aux --sort=-%cpu | head -10'],
  memory: ['free -h', 'ps aux --sort=-%mem | head -10', 'vmstat 1 5'],
  disk: [
    'df -h',
    'du -xhd1 / 2>/dev/null | sort -hr | head -20',
    'df -ih',
    'journalctl --disk-usage',
  ],
  network: ['ss -s', 'ss -tuna | head -50', 'ip -s link'],
  status: [
    'systemctl status <service> --no-pager',
    'journalctl -u <service> -n 100 --no-pager',
  ],
};
const RISK_ORDER: Record<OperationalRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface ReadOnlyDiagnosticCommandOptions {
  metric?: DiagnosticMetric;
  service?: string;
  limit?: number;
  maxRisk?: OperationalRisk;
}

function commandMatchesMetric(
  command: string,
  metric: DiagnosticMetric
): boolean {
  return METRIC_DIAGNOSTIC_COMMANDS[metric].includes(command);
}

function inferCommandSafety(command: string): CommandSafety {
  if (/service\s+restart|systemctl\s+restart|clear cache|(?:^|\s)rm\s|kill\s/i.test(command)) {
    return 'mutating';
  }

  if (
    /journalctl\s+--vacuum|apt-get\s+clean|^mount\s+-t|^umount\s|sysctl\s+-w/i.test(
      command
    )
  ) {
    return 'requires-approval';
  }

  return 'read-only';
}

function inferOperationalRisk(command: string): OperationalRisk {
  const safety = inferCommandSafety(command);
  if (safety === 'mutating' || safety === 'requires-approval') {
    return 'high';
  }

  if (
    /du\s+-xhd1|redis-cli\s+--bigkeys|awk\s|grep\s|tail\s+-100|netstat\s+-an/i.test(
      command
    )
  ) {
    return 'medium';
  }

  return 'low';
}

function inferDiagnosticMetric(
  recommendation: CommandRecommendation
): DiagnosticMetric {
  for (const metric of Object.keys(METRIC_DIAGNOSTIC_COMMANDS) as DiagnosticMetric[]) {
    if (commandMatchesMetric(recommendation.command, metric)) {
      return metric;
    }
  }

  const keywords = recommendation.keywords.map((keyword) => keyword.toLowerCase());
  if (keywords.some((keyword) => ['cpu', '프로세스', '부하'].includes(keyword))) {
    return 'cpu';
  }
  if (keywords.some((keyword) => ['memory', '메모리', 'oom'].includes(keyword))) {
    return 'memory';
  }
  if (keywords.some((keyword) => ['disk', '디스크', '용량', 'inode'].includes(keyword))) {
    return 'disk';
  }
  if (keywords.some((keyword) => ['network', '네트워크'].includes(keyword))) {
    return 'network';
  }

  return 'status';
}

function inferService(recommendation: CommandRecommendation): string | undefined {
  return SERVICE_KEYWORDS.find((service) =>
    recommendation.keywords.some((keyword) => keyword.toLowerCase() === service)
  );
}

export function enrichCommandRecommendation(
  recommendation: CommandRecommendation
): CommandRecommendation & {
  safety: CommandSafety;
  operationalRisk: OperationalRisk;
  metric: DiagnosticMetric;
} {
  return {
    ...recommendation,
    safety: recommendation.safety ?? inferCommandSafety(recommendation.command),
    operationalRisk:
      recommendation.operationalRisk ?? inferOperationalRisk(recommendation.command),
    metric: recommendation.metric ?? inferDiagnosticMetric(recommendation),
    service: recommendation.service ?? inferService(recommendation),
  };
}

function riskIsAtMost(
  risk: OperationalRisk,
  maxRisk: OperationalRisk
): boolean {
  return RISK_ORDER[risk] <= RISK_ORDER[maxRisk];
}

function getRecommendationByCommand(
  recommendations: readonly CommandRecommendation[],
  command: string
): CommandRecommendation | null {
  return (
    recommendations.find((recommendation) => recommendation.command === command) ??
    null
  );
}

export function getReadOnlyDiagnosticCommandsFromCatalog(
  recommendations: readonly CommandRecommendation[],
  {
    metric = 'status',
    service,
    limit = 3,
    maxRisk = 'medium',
  }: ReadOnlyDiagnosticCommandOptions
): CommandRecommendation[] {
  const normalizedService = service?.toLowerCase();
  const metricCommands = METRIC_DIAGNOSTIC_COMMANDS[metric]
    .map((command) => getRecommendationByCommand(recommendations, command))
    .filter((item): item is CommandRecommendation => item !== null);
  const serviceCommands = recommendations.filter((recommendation) => {
    if (!normalizedService) return false;
    const enriched = enrichCommandRecommendation(recommendation);
    return enriched.service === normalizedService && enriched.metric !== metric;
  });
  const seen = new Set<string>();

  return [...metricCommands, ...serviceCommands]
    .map(enrichCommandRecommendation)
    .filter((recommendation) => recommendation.safety === 'read-only')
    .filter((recommendation) =>
      riskIsAtMost(recommendation.operationalRisk, maxRisk)
    )
    .filter((recommendation) => {
      if (seen.has(recommendation.command)) return false;
      seen.add(recommendation.command);
      return true;
    })
    .slice(0, Math.max(0, limit));
}
