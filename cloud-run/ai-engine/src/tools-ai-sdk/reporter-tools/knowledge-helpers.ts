import type { RAGResultItem, ToolSeverityFilter } from './knowledge-types';

const COMMAND_INTENT_KEYWORDS = [
  'command',
  'cmd',
  'cli',
  'shell',
  'terminal',
  '명령어',
  '터미널',
  '쉘',
  'kubectl',
  'docker',
  'systemctl',
  'journalctl',
  'ps ',
  'top ',
  'df ',
  'free ',
  'netstat',
  'tail ',
] as const;

const INCIDENT_ANALYSIS_KEYWORDS = [
  'incident',
  '장애',
  'error',
  '에러',
  '오류',
  '원인',
  '분석',
  '대응',
  '복구',
  'timeout',
  '지연',
] as const;

const DESTRUCTIVE_COMMAND_TITLES = ['docker system prune'] as const;

const DESTRUCTIVE_COMMAND_QUERY_ALLOWLIST = [
  '정리',
  'cleanup',
  'clean up',
  '디스크',
  'disk',
  '용량',
  'space',
  'prune',
] as const;

export function getDynamicThreshold(query: string, category?: string): number {
  const q = query.toLowerCase();
  const urgentKeywords = [
    '장애',
    '긴급',
    'critical',
    'urgent',
    '에러',
    'error',
    'incident',
    '다운',
  ];
  if (urgentKeywords.some((k) => q.includes(k)) || category === 'incident') {
    return 0.25;
  }

  if (category === 'security' || category === 'performance') {
    return 0.35;
  }

  return 0.4;
}

export function getDynamicSearchWeights(
  query: string,
  category?: string,
): {
  vectorWeight: number;
  textWeight: number;
  graphWeight: number;
} {
  const q = query.toLowerCase();
  const technicalTerms = [
    'redis',
    'nginx',
    'docker',
    'postgresql',
    'mysql',
    'kubernetes',
    'k8s',
    'oom',
    'gc',
    'ssl',
    'tls',
    'dns',
  ];
  const hasTechnicalTerms =
    technicalTerms.filter((t) => q.includes(t)).length >= 1;

  if (category === 'incident' || category === 'troubleshooting') {
    return { vectorWeight: 0.4, textWeight: 0.25, graphWeight: 0.35 };
  }

  if (hasTechnicalTerms) {
    return { vectorWeight: 0.35, textWeight: 0.45, graphWeight: 0.2 };
  }

  return { vectorWeight: 0.5, textWeight: 0.3, graphWeight: 0.2 };
}

export function mapSeverityFilter(
  severity?: ToolSeverityFilter,
): 'info' | 'warning' | 'critical' | undefined {
  if (!severity) return undefined;
  if (severity === 'critical') return 'critical';
  if (severity === 'warning' || severity === 'high' || severity === 'medium') {
    return 'warning';
  }
  return 'info';
}

export function isCommandIntentQuery(query: string, category?: string): boolean {
  if (category === 'command') return true;
  const lowerQuery = query.toLowerCase();
  return COMMAND_INTENT_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword),
  );
}

function isIncidentAnalysisQuery(query: string, category?: string): boolean {
  if (category === 'incident' || category === 'troubleshooting') return true;
  const lowerQuery = query.toLowerCase();
  return INCIDENT_ANALYSIS_KEYWORDS.some((keyword) =>
    lowerQuery.includes(keyword),
  );
}

function normalizeTitleForDedup(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function deduplicateRagResultsByTitle(results: RAGResultItem[]): RAGResultItem[] {
  const bestByTitle = new Map<string, RAGResultItem>();
  for (const result of results) {
    const key = normalizeTitleForDedup(result.title);
    const existing = bestByTitle.get(key);
    if (!existing || result.similarity > existing.similarity) {
      bestByTitle.set(key, result);
    }
  }
  return Array.from(bestByTitle.values());
}

export function rebalanceRagResultsForMonitoring(
  results: RAGResultItem[],
  query: string,
  category?: string,
  maxResults?: number,
): RAGResultItem[] {
  if (results.length === 0) return results;

  const limit = maxResults && maxResults > 0 ? maxResults : results.length;
  const lowerQuery = query.toLowerCase();
  const allowDestructiveCommand = DESTRUCTIVE_COMMAND_QUERY_ALLOWLIST.some(
    (keyword) => lowerQuery.includes(keyword),
  );

  const deduplicated = deduplicateRagResultsByTitle(results)
    .filter((r) => {
      const title = r.title.trim().toLowerCase();
      if (
        !DESTRUCTIVE_COMMAND_TITLES.includes(
          title as (typeof DESTRUCTIVE_COMMAND_TITLES)[number],
        )
      ) {
        return true;
      }
      return allowDestructiveCommand || isCommandIntentQuery(query, category);
    })
    .sort((a, b) => b.similarity - a.similarity);

  if (isCommandIntentQuery(query, category)) {
    return deduplicated.slice(0, limit);
  }

  const incidentAnalysis = isIncidentAnalysisQuery(query, category);
  const rerankedForIntent = deduplicated
    .map((r) => {
      let adjustedScore = r.similarity;
      if (incidentAnalysis) {
        if (r.category === 'incident') adjustedScore += 0.08;
        else if (r.category === 'troubleshooting') adjustedScore += 0.05;
        else if (r.category === 'best_practice') adjustedScore += 0.03;
      }
      if (r.category === 'command') adjustedScore -= 0.04;
      return { ...r, similarity: adjustedScore };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const nonCommand = rerankedForIntent.filter((r) => r.category !== 'command');
  const command = rerankedForIntent.filter((r) => r.category === 'command');

  if (nonCommand.length === 0) {
    return deduplicated.slice(0, Math.min(limit, 2));
  }

  const commandCandidate = command.find((r) => r.similarity >= 0.45);
  const merged = commandCandidate ? [...nonCommand, commandCandidate] : nonCommand;

  return merged.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

export function extractKeywordsFromQuery(query: string): string[] {
  const keywords: string[] = [];
  const q = query.toLowerCase();

  const patterns = [
    { regex: /서버|server/gi, keyword: '서버' },
    { regex: /상태|status/gi, keyword: '상태' },
    { regex: /에러|error|오류/gi, keyword: '에러' },
    { regex: /로그|log/gi, keyword: '로그' },
    { regex: /메모리|memory/gi, keyword: '메모리' },
    { regex: /cpu|프로세서/gi, keyword: 'cpu' },
    { regex: /디스크|disk/gi, keyword: '디스크' },
    { regex: /재시작|restart/gi, keyword: '재시작' },
    { regex: /장애|failure|incident/gi, keyword: '장애' },
    { regex: /네트워크|network/gi, keyword: '네트워크' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(q)) {
      keywords.push(pattern.keyword);
    }
  }

  return keywords.length > 0 ? keywords : ['일반', '조회'];
}
