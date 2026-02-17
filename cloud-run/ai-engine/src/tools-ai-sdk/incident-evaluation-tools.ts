/**
 * Incident Report Evaluation & Optimization Tools (AI SDK Format)
 *
 * Evaluator-Optimizer pattern implementation for incident report quality.
 * - Evaluator tools: assess report quality, identify gaps
 * - Optimizer tools: refine root cause analysis, enhance actions
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import { tool } from 'ai';
import { z } from 'zod';

// Data sources
import { getCurrentState, getRecentHistory } from '../data/precomputed-state';

// Note: We define our own types to avoid coupling with incident-report-tools
// This allows for more flexible input validation

// ============================================================================
// 1. Types
// ============================================================================

/** Internal report type for evaluation (flexible input) */
interface EvaluationInputReport {
  title?: string;
  summary?: string;
  affectedServers?: Array<{
    id: string;
    name: string;
    status: string;
    primaryIssue: string;
  }>;
  timeline?: Array<{
    timestamp: string;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
  }>;
  rootCause?: {
    cause: string;
    confidence: number;
    evidence: string[];
    suggestedFix: string;
  } | null;
  suggestedActions?: string[];
  sla?: {
    targetUptime: number;
    actualUptime: number;
    slaViolation: boolean;
  };
  [key: string]: unknown;
}

export interface EvaluationScores {
  structure: number;      // 구조 완성도 (0-1)
  completeness: number;   // 내용 완성도 (0-1)
  accuracy: number;       // 분석 정확도 (0-1)
  actionability: number;  // 조치 실행가능성 (0-1)
}

export interface EvaluationResult {
  scores: EvaluationScores;
  overallScore: number;
  needsOptimization: boolean;
  issues: string[];
  recommendations: string[];
}

export interface EnhancedAction {
  description: string;
  commands: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedImpact: string;
}

// ============================================================================
// 2. Constants
// ============================================================================

const QUALITY_THRESHOLD = 0.75;

const COMMAND_TEMPLATES: Record<string, string[]> = {
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

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Calculate structure completeness score
 */
function calculateStructureScore(report: EvaluationInputReport): number {
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

/**
 * Calculate content completeness score
 */
function calculateCompletenessScore(report: EvaluationInputReport): number {
  const requiredFields = ['title', 'summary', 'affectedServers', 'timeline', 'rootCause', 'suggestedActions', 'sla'];
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

/**
 * Calculate actionability score based on specificity of actions
 */
function calculateActionabilityScore(actions: string[]): number {
  if (!actions || actions.length === 0) return 0;

  let score = 0;
  const checkPatterns = [
    { pattern: /`[^`]+`/, weight: 0.3 },  // Contains CLI commands
    { pattern: /^\$|^sudo|^systemctl|^docker/, weight: 0.25 },  // Starts with command
    { pattern: /확인|점검|검토/, weight: 0.1 },  // Has verification steps
    { pattern: /\d+/, weight: 0.05 },  // Contains specific numbers
  ];

  for (const action of actions) {
    for (const { pattern, weight } of checkPatterns) {
      if (pattern.test(action)) {
        score += weight / actions.length;
      }
    }
  }

  // Base score for having actions
  score += 0.3 * Math.min(actions.length / 3, 1);

  return Math.min(score, 1);
}

/**
 * Identify issues in the report
 */
function identifyIssues(report: EvaluationInputReport, scores: EvaluationScores): string[] {
  const issues: string[] = [];

  if (scores.structure < 0.6) issues.push('보고서 구조가 불완전합니다');
  if (scores.completeness < 0.7) issues.push('필수 필드가 누락되어 있습니다');
  if (scores.accuracy < 0.75) issues.push('근본원인 분석 신뢰도가 부족합니다');
  if (scores.actionability < 0.7) issues.push('권장 조치가 너무 일반적입니다');

  if (!report.timeline || report.timeline.length < 3) {
    issues.push('타임라인 이벤트가 3개 미만입니다');
  }

  if (!report.rootCause || (report.rootCause.evidence && report.rootCause.evidence.length < 2)) {
    issues.push('근본원인 분석에 증거가 부족합니다');
  }

  if (!report.suggestedActions || report.suggestedActions.length < 2) {
    issues.push('권장 조치가 2개 미만입니다');
  }

  return issues;
}

/**
 * Generate recommendations based on scores
 */
function generateRecommendations(scores: EvaluationScores): string[] {
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

// ============================================================================
// 4. Evaluator Tools
// ============================================================================

/**
 * Evaluate Incident Report Quality
 */
export const evaluateIncidentReport = tool({
  description:
    '장애 보고서의 품질을 종합 평가합니다. 구조 완성도, 내용 완성도, 분석 정확도, 조치 실행가능성을 점수화합니다.',
  inputSchema: z.object({
    report: z.object({
      title: z.string().optional(),
      summary: z.string().optional(),
      affectedServers: z.array(z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        primaryIssue: z.string(),
      })).optional(),
      timeline: z.array(z.object({
        timestamp: z.string(),
        eventType: z.string(),
        severity: z.enum(['info', 'warning', 'critical']),
        description: z.string(),
      })).optional(),
      rootCause: z.object({
        cause: z.string(),
        confidence: z.number(),
        evidence: z.array(z.string()),
        suggestedFix: z.string(),
      }).nullable().optional(),
      suggestedActions: z.array(z.string()).optional(),
      sla: z.object({
        targetUptime: z.number(),
        actualUptime: z.number(),
        slaViolation: z.boolean(),
      }).optional(),
    }).describe('평가할 장애 보고서'),
  }),
  execute: async ({ report }) => {
    console.log('📊 [Evaluator] Evaluating incident report quality');

    const scores: EvaluationScores = {
      structure: calculateStructureScore(report),
      completeness: calculateCompletenessScore(report),
      accuracy: report.rootCause?.confidence ?? 0.5,
      actionability: calculateActionabilityScore(report.suggestedActions || []),
    };

    const overallScore = (
      scores.structure * 0.2 +
      scores.completeness * 0.25 +
      scores.accuracy * 0.35 +
      scores.actionability * 0.2
    );

    const issues = identifyIssues(report, scores);
    const recommendations = generateRecommendations(scores);

    const result: EvaluationResult = {
      scores,
      overallScore,
      needsOptimization: overallScore < QUALITY_THRESHOLD,
      issues,
      recommendations,
    };

    console.log(`📊 [Evaluator] Score: ${(overallScore * 100).toFixed(1)}%, needs optimization: ${result.needsOptimization}`);

    return {
      success: true,
      evaluation: result,
      summary: result.needsOptimization
        ? `⚠️ 품질 점수 ${(overallScore * 100).toFixed(1)}% - 최적화 필요 (임계값: ${QUALITY_THRESHOLD * 100}%)`
        : `✅ 품질 점수 ${(overallScore * 100).toFixed(1)}% - 기준 충족`,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Validate Report Structure
 */
export const validateReportStructure = tool({
  description:
    '보고서의 구조적 완성도를 검증합니다. 필수 필드 존재 여부, 데이터 형식, 값의 유효성을 확인합니다.',
  inputSchema: z.object({
    report: z.object({
      title: z.string().optional(),
      summary: z.string().optional(),
      affectedServers: z.array(z.any()).optional(),
      timeline: z.array(z.any()).optional(),
      rootCause: z.any().optional(),
      suggestedActions: z.array(z.string()).optional(),
    }).describe('검증할 보고서'),
  }),
  execute: async ({ report }) => {
    console.log('🔍 [Validator] Validating report structure');

    const validationResults: Array<{ field: string; valid: boolean; message: string }> = [];

    // Title validation
    validationResults.push({
      field: 'title',
      valid: typeof report.title === 'string' && report.title.length >= 5,
      message: report.title ? '제목이 유효합니다' : '제목이 누락되었거나 너무 짧습니다',
    });

    // Summary validation
    const summaryLength = report.summary?.length ?? 0;
    validationResults.push({
      field: 'summary',
      valid: typeof report.summary === 'string' && summaryLength >= 20,
      message: summaryLength >= 20 ? '요약이 유효합니다' : '요약이 너무 짧습니다',
    });

    // Affected servers validation
    validationResults.push({
      field: 'affectedServers',
      valid: Array.isArray(report.affectedServers) && report.affectedServers.length > 0,
      message: report.affectedServers?.length ? `${report.affectedServers.length}대 서버 정보 포함` : '영향받은 서버 정보 없음',
    });

    // Timeline validation
    const timelineLength = report.timeline?.length ?? 0;
    validationResults.push({
      field: 'timeline',
      valid: Array.isArray(report.timeline) && timelineLength >= 3,
      message: timelineLength >= 3 ? `${timelineLength}개 타임라인 이벤트` : '타임라인이 부족합니다 (최소 3개)',
    });

    // Root cause validation
    const hasValidRootCause = report.rootCause &&
      typeof report.rootCause.cause === 'string' &&
      typeof report.rootCause.confidence === 'number';
    validationResults.push({
      field: 'rootCause',
      valid: hasValidRootCause,
      message: hasValidRootCause ? '근본원인 분석 포함' : '근본원인 분석이 없거나 불완전합니다',
    });

    // Suggested actions validation
    const actionsLength = report.suggestedActions?.length ?? 0;
    validationResults.push({
      field: 'suggestedActions',
      valid: Array.isArray(report.suggestedActions) && actionsLength >= 2,
      message: actionsLength >= 2 ? `${actionsLength}개 권장 조치` : '권장 조치가 부족합니다',
    });

    const passedCount = validationResults.filter(r => r.valid).length;
    const totalCount = validationResults.length;
    const passRate = passedCount / totalCount;

    return {
      success: true,
      validationResults,
      passedCount,
      totalCount,
      passRate,
      summary: passRate >= 0.8
        ? `✅ 구조 검증 통과 (${passedCount}/${totalCount})`
        : `⚠️ 구조 검증 실패 (${passedCount}/${totalCount})`,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Score Root Cause Confidence
 */
export const scoreRootCauseConfidence = tool({
  description:
    '근본원인 분석의 신뢰도를 상세 점수화합니다. 증거 품질, 인과관계 명확성, 재현가능성을 평가합니다.',
  inputSchema: z.object({
    rootCause: z.object({
      cause: z.string(),
      confidence: z.number(),
      evidence: z.array(z.string()),
      suggestedFix: z.string(),
    }).describe('평가할 근본원인 분석'),
    affectedServersCount: z.number().default(1).describe('영향받은 서버 수'),
    timelineEventsCount: z.number().default(0).describe('타임라인 이벤트 수'),
  }),
  execute: async ({ rootCause, affectedServersCount, timelineEventsCount }) => {
    console.log('📈 [RCA Scorer] Scoring root cause confidence');

    // Evidence quality score
    const evidenceScore = Math.min(rootCause.evidence.length / 5, 1) * 0.4;

    // Cause specificity score
    const hasSpecificMetric = /CPU|Memory|Disk|Network|메모리|디스크/i.test(rootCause.cause);
    const hasServerName = /server|srv|서버/i.test(rootCause.cause);
    const specificityScore = (hasSpecificMetric ? 0.3 : 0) + (hasServerName ? 0.2 : 0);

    // Correlation score (more affected servers = higher correlation needed)
    const correlationScore = affectedServersCount > 1
      ? Math.min(timelineEventsCount / (affectedServersCount * 2), 1) * 0.3
      : 0.2;

    // Fix actionability score
    const hasActionableFix = /확인|점검|재시작|증설|정리/i.test(rootCause.suggestedFix);
    const fixScore = hasActionableFix ? 0.1 : 0.05;

    const calculatedConfidence = evidenceScore + specificityScore + correlationScore + fixScore;
    const finalConfidence = Math.min(Math.max(calculatedConfidence, 0.3), 0.95);

    return {
      success: true,
      originalConfidence: rootCause.confidence,
      calculatedConfidence: finalConfidence,
      breakdown: {
        evidenceQuality: evidenceScore,
        causeSpecificity: specificityScore,
        correlationStrength: correlationScore,
        fixActionability: fixScore,
      },
      recommendation: finalConfidence < 0.75
        ? 'refineRootCauseAnalysis 도구로 추가 분석 필요'
        : '신뢰도 충분',
      timestamp: new Date().toISOString(),
    };
  },
});

// ============================================================================
// 5. Optimizer Tools
// ============================================================================

/**
 * Refine Root Cause Analysis
 */
export const refineRootCauseAnalysis = tool({
  description:
    '낮은 신뢰도의 근본원인 분석을 심화합니다. 추가 메트릭 분석과 서버 간 상관관계를 통해 신뢰도를 향상시킵니다.',
  inputSchema: z.object({
    serverId: z.string().describe('분석 대상 서버 ID'),
    currentCause: z.string().describe('현재 추정 원인'),
    currentConfidence: z.number().describe('현재 신뢰도'),
  }),
  execute: async ({ serverId, currentCause, currentConfidence }) => {
    console.log(`🔬 [Optimizer] Refining root cause for ${serverId}`);

    const state = getCurrentState();
    const server = state.servers.find(s => s.id === serverId);

    if (!server) {
      return {
        success: false,
        error: `Server not found: ${serverId}`,
      };
    }

    // Analyze additional evidence
    const additionalEvidence: string[] = [];
    let refinedCause = currentCause;
    let confidenceBoost = 0;

    // Check current metrics
    if (server.cpu > 90) {
      additionalEvidence.push(`현재 CPU ${server.cpu.toFixed(1)}% (임계값 90% 초과)`);
      confidenceBoost += 0.1;
      if (!currentCause.toLowerCase().includes('cpu')) {
        refinedCause = `CPU 과부하 (${server.cpu.toFixed(1)}%) - ${currentCause}`;
      }
    }

    if (server.memory > 90) {
      additionalEvidence.push(`현재 Memory ${server.memory.toFixed(1)}% (임계값 90% 초과)`);
      confidenceBoost += 0.1;
    }

    if (server.disk > 95) {
      additionalEvidence.push(`현재 Disk ${server.disk.toFixed(1)}% (임계값 95% 초과)`);
      confidenceBoost += 0.1;
    }

    // Analyze historical trend from precomputed-state
    const history = getRecentHistory(6);
    if (history.length > 0) {
      const cpuTrend = history
        .map((h) => h.servers.find((s) => s.id === serverId)?.cpu)
        .filter((v): v is number => v !== undefined);

      if (cpuTrend.length > 0) {
        const avgCpu = cpuTrend.reduce((a, b) => a + b, 0) / cpuTrend.length;
        if (avgCpu > 85) {
          additionalEvidence.push(`최근 1시간 평균 CPU ${avgCpu.toFixed(1)}% (지속적 고부하)`);
          confidenceBoost += 0.05;
        }

        // Check for spike pattern
        const maxCpu = Math.max(...cpuTrend);
        const minCpu = Math.min(...cpuTrend);
        if (maxCpu - minCpu > 30) {
          additionalEvidence.push(`CPU 변동폭 ${(maxCpu - minCpu).toFixed(1)}% (불안정 패턴 감지)`);
          confidenceBoost += 0.05;
        }
      }
    }

    // Check related servers
    const relatedServers = state.servers.filter(s =>
      s.id !== serverId &&
      (s.status === 'warning' || s.status === 'critical')
    );

    if (relatedServers.length > 0) {
      additionalEvidence.push(`연관 이상 서버 ${relatedServers.length}대 감지 (복합 장애 가능성)`);
      confidenceBoost += 0.05;
    }

    const improvedConfidence = Math.min(currentConfidence + confidenceBoost, 0.95);

    return {
      success: true,
      serverId,
      refinedCause,
      originalConfidence: currentConfidence,
      improvedConfidence,
      confidenceBoost,
      additionalEvidence,
      summary: improvedConfidence >= 0.75
        ? `✅ 신뢰도 향상: ${(currentConfidence * 100).toFixed(0)}% → ${(improvedConfidence * 100).toFixed(0)}%`
        : `⚠️ 추가 분석 필요: ${(improvedConfidence * 100).toFixed(0)}%`,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Enhance Suggested Actions
 */
export const enhanceSuggestedActions = tool({
  description:
    '일반적인 권장 조치를 CLI 명령어 포함 구체적 조치로 개선합니다. 실행 가능한 구체적 단계를 제공합니다.',
  inputSchema: z.object({
    actions: z.array(z.string()).describe('현재 권장 조치 목록'),
    focusArea: z.enum(['cpu', 'memory', 'disk', 'network', 'general']).default('general').describe('주요 문제 영역'),
  }),
  execute: async ({ actions, focusArea }) => {
    console.log(`🔧 [Optimizer] Enhancing actions for ${focusArea}`);

    const commands = COMMAND_TEMPLATES[focusArea] || COMMAND_TEMPLATES.general;

    const enhancedActions: EnhancedAction[] = actions.map((action: string) => {
      // Determine priority based on action content
      let priority: EnhancedAction['priority'] = 'medium';
      if (/긴급|즉시|critical/i.test(action)) priority = 'critical';
      else if (/확인|점검/i.test(action)) priority = 'high';
      else if (/모니터링|관찰/i.test(action)) priority = 'low';

      // Select relevant commands
      const relevantCommands = commands.slice(0, 2);

      return {
        description: action,
        commands: relevantCommands,
        priority,
        estimatedImpact: priority === 'critical' ? '즉각적 문제 해결'
          : priority === 'high' ? '단기간 내 개선'
          : '점진적 개선',
      };
    });

    // Add additional recommended actions if few provided
    if (enhancedActions.length < 3) {
      enhancedActions.push({
        description: `시스템 로그 분석으로 추가 원인 파악`,
        commands: COMMAND_TEMPLATES.general.slice(0, 2),
        priority: 'medium',
        estimatedImpact: '근본 원인 파악에 도움',
      });
    }

    return {
      success: true,
      originalCount: actions.length,
      enhancedCount: enhancedActions.length,
      enhancedActions,
      focusArea,
      summary: `✅ ${actions.length}개 조치를 CLI 명령어 포함 ${enhancedActions.length}개로 개선`,
      timestamp: new Date().toISOString(),
    };
  },
});

/**
 * Extend Server Correlation Analysis
 */
export const extendServerCorrelation = tool({
  description:
    '서버 간 연관성 분석을 확장합니다. 추가 패턴 감지와 cascade 영향 분석을 수행합니다.',
  inputSchema: z.object({
    primaryServerId: z.string().describe('주요 장애 서버 ID'),
    existingCorrelations: z.array(z.object({
      serverId: z.string(),
      correlatedWith: z.string(),
      correlationType: z.string(),
    })).default([]).describe('기존 연관 분석 결과'),
  }),
  execute: async ({ primaryServerId, existingCorrelations }) => {
    console.log(`🔗 [Optimizer] Extending correlation from ${primaryServerId}`);

    const state = getCurrentState();
    const primaryServer = state.servers.find(s => s.id === primaryServerId);

    if (!primaryServer) {
      return {
        success: false,
        error: `Server not found: ${primaryServerId}`,
      };
    }

    const newCorrelations: Array<{
      serverId: string;
      correlatedWith: string;
      correlationType: 'cascade' | 'simultaneous' | 'periodic';
      confidence: number;
      affectedMetric: string;
      description: string;
    }> = [];

    // Find servers with similar status
    const similarServers = state.servers.filter(s =>
      s.id !== primaryServerId &&
      s.status === primaryServer.status
    );

    for (const server of similarServers) {
      // Check if already in existing correlations
      const alreadyCorrelated = existingCorrelations.some((c: { serverId: string; correlatedWith: string; correlationType: string }) =>
        (c.serverId === primaryServerId && c.correlatedWith === server.id) ||
        (c.serverId === server.id && c.correlatedWith === primaryServerId)
      );

      if (alreadyCorrelated) continue;

      // Determine correlation type and affected metric
      let correlationType: 'cascade' | 'simultaneous' | 'periodic' = 'simultaneous';
      let affectedMetric = 'cpu';
      let confidence = 0.6;

      // Check for similar high metrics
      if (primaryServer.cpu > 80 && server.cpu > 80) {
        affectedMetric = 'cpu';
        confidence = 0.75;
        if (Math.abs(primaryServer.cpu - server.cpu) < 10) {
          correlationType = 'simultaneous';
        } else {
          correlationType = 'cascade';
        }
      } else if (primaryServer.memory > 80 && server.memory > 80) {
        affectedMetric = 'memory';
        confidence = 0.7;
      } else if (primaryServer.disk > 85 && server.disk > 85) {
        affectedMetric = 'disk';
        confidence = 0.65;
      }

      newCorrelations.push({
        serverId: primaryServerId,
        correlatedWith: server.id,
        correlationType,
        confidence,
        affectedMetric,
        description: `${primaryServer.name}과 ${server.name}의 ${affectedMetric} 연관 (${correlationType})`,
      });
    }

    return {
      success: true,
      primaryServerId,
      existingCount: existingCorrelations.length,
      newCorrelationsCount: newCorrelations.length,
      newCorrelations,
      totalCorrelations: existingCorrelations.length + newCorrelations.length,
      summary: newCorrelations.length > 0
        ? `✅ ${newCorrelations.length}개의 새로운 서버 연관성 발견`
        : '새로운 연관성 없음',
      timestamp: new Date().toISOString(),
    };
  },
});

// ============================================================================
// 6. Export All Tools
// ============================================================================

export const incidentEvaluationTools = {
  // Evaluator tools
  evaluateIncidentReport,
  validateReportStructure,
  scoreRootCauseConfidence,
  // Optimizer tools
  refineRootCauseAnalysis,
  enhanceSuggestedActions,
  extendServerCorrelation,
};

export default incidentEvaluationTools;
