import type {
  EvaluationInputReport,
  EvaluationScores,
} from './incident-evaluation-types';

export const QUALITY_THRESHOLD = 0.75;

export const COMMAND_TEMPLATES: Record<string, string[]> = {
  cpu: [
    'top -o %CPU -b -n 1 | head -20',
    'ps aux --sort=-%cpu | head -10',
    'pidstat -u 1 5',
  ],
  memory: [
    'free -h',
    'ps aux --sort=-%mem | head -10',
    'cat /proc/meminfo | grep -E "MemTotal|MemFree|Buffers|Cached"',
    'vmstat 1 5',
  ],
  disk: [
    'df -h',
    'du -sh /* 2>/dev/null | sort -hr | head -10',
    'lsof +D /var/log 2>/dev/null | wc -l',
    'find /tmp -type f -mtime +7 -exec rm {} \\;',
  ],
  network: [
    'netstat -tuln',
    'ss -tuln',
    'iftop -t -s 5 2>/dev/null || netstat -i',
    'tcpdump -c 100 -i any 2>/dev/null | head -20',
  ],
  general: [
    'systemctl status',
    'journalctl -xe --no-pager | tail -50',
    'dmesg | tail -30',
    'uptime',
  ],
};

export function calculateStructureScore(report: EvaluationInputReport): number {
  let score = 0;
  const weights = {
    title: 0.1,
    summary: 0.15,
    affectedServers: 0.15,
    timeline: 0.2,
    rootCause: 0.25,
    suggestedActions: 0.15,
  };

  if (report.title && report.title.length > 5) score += weights.title;
  if (report.summary && report.summary.length > 20) score += weights.summary;
  if (report.affectedServers && report.affectedServers.length > 0) score += weights.affectedServers;
  if (report.timeline && report.timeline.length >= 3) score += weights.timeline;
  if (report.rootCause && report.rootCause.confidence > 0) score += weights.rootCause;
  if (report.suggestedActions && report.suggestedActions.length >= 2) score += weights.suggestedActions;

  return score;
}

export function calculateCompletenessScore(report: EvaluationInputReport): number {
  const requiredFields = [
    'title',
    'summary',
    'affectedServers',
    'timeline',
    'rootCause',
    'suggestedActions',
    'sla',
  ];
  let filled = 0;

  for (const field of requiredFields) {
    const value = report[field];
    if (value !== undefined && value !== null) {
      if (Array.isArray(value) && value.length > 0) filled++;
      else if (typeof value === 'object' && Object.keys(value).length > 0) filled++;
      else if (typeof value === 'string' && value.length > 0) filled++;
    }
  }

  return filled / requiredFields.length;
}

export function calculateActionabilityScore(actions: string[]): number {
  if (!actions || actions.length === 0) return 0;

  let score = 0;
  const checkPatterns = [
    { pattern: /`[^`]+`/, weight: 0.3 },
    { pattern: /^\$|^sudo|^systemctl|^docker/, weight: 0.25 },
    { pattern: /확인|점검|검토/, weight: 0.1 },
    { pattern: /\d+/, weight: 0.05 },
  ];

  for (const action of actions) {
    for (const { pattern, weight } of checkPatterns) {
      if (pattern.test(action)) {
        score += weight / actions.length;
      }
    }
  }

  score += 0.3 * Math.min(actions.length / 3, 1);
  return Math.min(score, 1);
}

export function identifyIssues(
  report: EvaluationInputReport,
  scores: EvaluationScores,
): string[] {
  const issues: string[] = [];

  if (scores.structure < 0.6) issues.push('보고서 구조가 불완전합니다');
  if (scores.completeness < 0.7) issues.push('필수 필드가 누락되어 있습니다');
  if (scores.accuracy < 0.75) issues.push('근본원인 분석 신뢰도가 부족합니다');
  if (scores.actionability < 0.7) issues.push('권장 조치가 너무 일반적입니다');

  if (!report.timeline || report.timeline.length < 3) {
    issues.push('타임라인 이벤트가 3개 미만입니다');
  }

  if (
    !report.rootCause ||
    (report.rootCause.evidence && report.rootCause.evidence.length < 2)
  ) {
    issues.push('근본원인 분석에 증거가 부족합니다');
  }

  if (!report.suggestedActions || report.suggestedActions.length < 2) {
    issues.push('권장 조치가 2개 미만입니다');
  }

  return issues;
}

export function generateRecommendations(scores: EvaluationScores): string[] {
  const recommendations: string[] = [];

  if (scores.accuracy < 0.75) {
    recommendations.push('refineRootCauseAnalysis 도구로 추가 분석을 수행하세요');
  }

  if (scores.actionability < 0.7) {
    recommendations.push('enhanceSuggestedActions 도구로 CLI 명령어를 추가하세요');
  }

  if (scores.completeness < 0.7) {
    recommendations.push('누락된 필드를 채우고 타임라인을 보완하세요');
  }

  if (scores.structure < 0.6) {
    recommendations.push('validateReportStructure 도구로 구조를 검증하세요');
  }

  return recommendations;
}
