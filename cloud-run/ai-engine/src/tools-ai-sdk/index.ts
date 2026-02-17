/**
 * AI SDK Tools Registry
 *
 * Central export point for all Vercel AI SDK tools.
 * These tools replace the LangChain-based tools.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

// ============================================================================
// Server Metrics Tools
// ============================================================================
export {
  getServerMetrics,
  getServerMetricsAdvanced,
  filterServers,
  getServerByGroup,
  getServerByGroupAdvanced,
} from './server-metrics';

// ============================================================================
// RCA (Root Cause Analysis) Tools
// ============================================================================
export {
  buildIncidentTimeline,
  correlateMetrics,
  findRootCause,
} from './rca-analysis';

// ============================================================================
// Analyst Tools (Anomaly Detection & Trend Prediction)
// ============================================================================
export {
  detectAnomalies,
  detectAnomaliesAllServers,
  predictTrends,
  analyzePattern,
} from './analyst-tools';

// ============================================================================
// Analysis Result Types
// ============================================================================
export type {
  SystemSummary,
  ServerAnomalyItem,
  DetectAnomaliesAllServersResult,
  DetectAnomaliesAllServersError,
  DetectAnomaliesAllServersResponse,
  AnomalyResultItem,
  DetectAnomaliesResult,
  DetectAnomaliesError,
  DetectAnomaliesResponse,
} from '../types/analysis-results';

// ============================================================================
// Reporter Tools (RAG Search & Command Recommendations & Web Search)
// ============================================================================
export {
  searchKnowledgeBase,
  recommendCommands,
  extractKeywordsFromQuery,
  searchWeb,
} from './reporter-tools';

// ============================================================================
// Incident Evaluation Tools (Evaluator-Optimizer Pattern)
// ============================================================================
export {
  evaluateIncidentReport,
  validateReportStructure,
  scoreRootCauseConfidence,
  refineRootCauseAnalysis,
  enhanceSuggestedActions,
  extendServerCorrelation,
  incidentEvaluationTools,
} from './incident-evaluation-tools';

// ============================================================================
// Server Logs Tool
// ============================================================================
export { getServerLogs } from './server-logs';

// ============================================================================
// Final Answer Tool (AI SDK v6 Best Practice)
// ============================================================================
export { finalAnswer, type FinalAnswerResult } from './final-answer';

// ============================================================================
// Vision Tools (Gemini Flash-Lite - Vision Agent)
// ============================================================================
export {
  analyzeScreenshot,
  analyzeLargeLog,
  searchWithGrounding,
  analyzeUrlContent,
  visionTools,
  visionToolDescriptions,
} from './vision-tools';

export type {
  ScreenshotAnalysisResult,
  LogAnalysisResult,
  SearchGroundingResult,
  UrlContentResult,
} from './vision-tools';

// ============================================================================
// Tool Collections (for Supervisor)
// ============================================================================
import { getServerMetrics, getServerMetricsAdvanced, filterServers, getServerByGroup, getServerByGroupAdvanced } from './server-metrics';
import { buildIncidentTimeline, correlateMetrics, findRootCause } from './rca-analysis';
import { detectAnomalies, detectAnomaliesAllServers, predictTrends, analyzePattern } from './analyst-tools';
import { searchKnowledgeBase, recommendCommands, searchWeb } from './reporter-tools';
import { evaluateIncidentReport, validateReportStructure, scoreRootCauseConfidence, refineRootCauseAnalysis, enhanceSuggestedActions, extendServerCorrelation } from './incident-evaluation-tools';
import { finalAnswer } from './final-answer';
import { getServerLogs } from './server-logs';
import { analyzeScreenshot, analyzeLargeLog, searchWithGrounding, analyzeUrlContent } from './vision-tools';
import type { ToolSet } from 'ai';
import { logger } from '../lib/logger';

/**
 * All available tools for the AI SDK Supervisor
 */
export const allTools: ToolSet = {
  // Server Metrics (NLQ)
  getServerMetrics,
  getServerMetricsAdvanced,
  filterServers,
  getServerByGroup,
  getServerByGroupAdvanced,

  // RCA Analysis
  buildIncidentTimeline,
  correlateMetrics,
  findRootCause,

  // Analyst
  detectAnomalies,
  detectAnomaliesAllServers,
  predictTrends,
  analyzePattern,

  // Reporter
  searchKnowledgeBase,
  recommendCommands,
  searchWeb,

  // Incident Evaluation (Evaluator-Optimizer Pattern)
  evaluateIncidentReport,
  validateReportStructure,
  scoreRootCauseConfidence,
  refineRootCauseAnalysis,
  enhanceSuggestedActions,
  extendServerCorrelation,

  // Server Logs
  getServerLogs,

  // Final Answer (AI SDK v6 Best Practice - terminates tool loop)
  finalAnswer,

  // Vision Tools (Gemini Flash-Lite)
  analyzeScreenshot,
  analyzeLargeLog,
  searchWithGrounding,
  analyzeUrlContent,
};

/**
 * Tool categories for routing
 */
export const toolCategories = {
  metrics: {
    getServerMetrics,
    getServerMetricsAdvanced,
    filterServers,
    getServerByGroup,
    getServerByGroupAdvanced,
    getServerLogs,
  },
  rca: {
    buildIncidentTimeline,
    correlateMetrics,
    findRootCause,
  },
  analyst: {
    detectAnomalies,
    detectAnomaliesAllServers,
    predictTrends,
    analyzePattern,
  },
  reporter: {
    searchKnowledgeBase,
    recommendCommands,
    searchWeb,
  },
  evaluation: {
    evaluateIncidentReport,
    validateReportStructure,
    scoreRootCauseConfidence,
    refineRootCauseAnalysis,
    enhanceSuggestedActions,
    extendServerCorrelation,
  },
  control: {
    finalAnswer,
  },
  vision: {
    analyzeScreenshot,
    analyzeLargeLog,
    searchWithGrounding,
    analyzeUrlContent,
  },
};

/**
 * Tool descriptions for intent classification
 */
export const toolDescriptions: Record<string, string> = {
  getServerMetrics: '서버 상태 조회 (CPU, 메모리, 디스크)',
  getServerMetricsAdvanced: '고급 서버 메트릭 조회 (시간범위, 필터, 집계)',
  filterServers: '조건에 맞는 서버 필터링',
  getServerByGroup: '서버 그룹/타입 조회 (db, lb, web, cache 등)',
  getServerByGroupAdvanced: '서버 그룹 복합 조회 (필터링, 정렬, 제한)',
  getServerLogs: '서버 로그 조회 (에러, 경고, 시스템 로그)',
  buildIncidentTimeline: '장애 타임라인 구성',
  correlateMetrics: '메트릭 간 상관관계 분석',
  findRootCause: '근본 원인 분석 (RCA)',
  detectAnomalies: '이상치 탐지 (통계: 2σ)',
  detectAnomaliesAllServers: '전체 서버 이상치 스캔 (장애보고서용)',
  predictTrends: '트렌드 예측',
  analyzePattern: '패턴 분석',
  searchKnowledgeBase: '과거 장애 이력 및 해결 방법 검색 (GraphRAG)',
  recommendCommands: 'CLI 명령어 추천',
  searchWeb: '실시간 웹 검색 (Tavily) - 최신 기술 정보, 보안 이슈',
  // Incident Evaluation
  evaluateIncidentReport: '장애 보고서 품질 종합 평가 (구조, 완성도, 정확도, 실행가능성)',
  validateReportStructure: '보고서 구조적 완성도 검증',
  scoreRootCauseConfidence: '근본원인 분석 신뢰도 상세 점수화',
  refineRootCauseAnalysis: '낮은 신뢰도 근본원인 분석 심화',
  enhanceSuggestedActions: '권장 조치 CLI 명령어 포함 구체화',
  extendServerCorrelation: '서버 간 연관성 분석 확장',
  // Control
  finalAnswer: '최종 응답 제출 (도구 루프 종료 신호)',
  // Vision (Gemini Flash-Lite)
  analyzeScreenshot: '대시보드 스크린샷 분석 (Grafana, CloudWatch, Datadog)',
  analyzeLargeLog: '대용량 로그 파일 분석 (1M 컨텍스트)',
  searchWithGrounding: 'Google Search Grounding 실시간 검색',
  analyzeUrlContent: 'URL 콘텐츠 추출 및 분석',
};

export type ToolName = keyof typeof allTools;
export type ToolCategory = keyof typeof toolCategories;

// ============================================================================
// Tool Validation
// ============================================================================

export interface ToolValidationResult {
  isValid: boolean;
  totalTools: number;
  validTools: string[];
  invalidTools: string[];
  missingDescriptions: string[];
  errors: string[];
}

/**
 * Validate all tools at startup
 * Checks:
 * - Tool exists and is a function
 * - Tool has a description
 * - Tool categories are consistent
 */
export function validateTools(): ToolValidationResult {
  const result: ToolValidationResult = {
    isValid: true,
    totalTools: 0,
    validTools: [],
    invalidTools: [],
    missingDescriptions: [],
    errors: [],
  };

  const toolNames = Object.keys(allTools) as ToolName[];
  result.totalTools = toolNames.length;

  for (const name of toolNames) {
    const tool = allTools[name];

    // Check if tool is defined
    if (!tool) {
      result.invalidTools.push(name);
      result.errors.push(`Tool "${name}" is undefined`);
      result.isValid = false;
      continue;
    }

    // Check if tool has execute function (AI SDK tool interface)
    if (typeof tool !== 'object' || !('execute' in tool || 'generate' in tool)) {
      // Some tools might be wrapped differently, just warn
      logger.warn(`⚠️ [ToolValidation] Tool "${name}" may not have standard structure`);
    }

    // Check if tool has description
    if (!toolDescriptions[name]) {
      result.missingDescriptions.push(name);
    }

    result.validTools.push(name);
  }

  // Validate tool categories consistency
  const categorizedTools = new Set<string>();
  for (const category of Object.keys(toolCategories) as ToolCategory[]) {
    const categoryTools = toolCategories[category];
    for (const toolName of Object.keys(categoryTools)) {
      categorizedTools.add(toolName);
    }
  }

  // Find tools not in any category
  for (const name of toolNames) {
    if (!categorizedTools.has(name)) {
      result.errors.push(`Tool "${name}" is not assigned to any category`);
    }
  }

  return result;
}

/**
 * Log tool validation result
 */
export function logToolValidation(): void {
  const result = validateTools();

  if (result.isValid) {
    console.log(`✅ [ToolValidation] ${result.totalTools} tools validated successfully`);
    console.log(`   Tools: [${result.validTools.join(', ')}]`);
  } else {
    logger.error(`❌ [ToolValidation] Validation failed!`);
    logger.error(`   Invalid tools: [${result.invalidTools.join(', ')}]`);
    for (const error of result.errors) {
      logger.error(`   - ${error}`);
    }
  }

  if (result.missingDescriptions.length > 0) {
    logger.warn(`⚠️ [ToolValidation] Missing descriptions: [${result.missingDescriptions.join(', ')}]`);
  }
}

// Run validation at module load (startup)
logToolValidation();
