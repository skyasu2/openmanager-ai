/**
 * Agent Configurations (SSOT)
 *
 * Single Source of Truth for all agent configurations.
 * This file centralizes agent settings to eliminate DRY violations.
 *
 * Architecture:
 * - Instructions: Imported from ./instructions/
 * - Tools: Imported from ../../../../tools-ai-sdk
 * - Models: Configured via getModel functions with fallback chains
 *
 * @version 1.0.0
 * @created 2026-01-06
 */

import type { ToolSet } from 'ai';

// Tool type from AI SDK
type ToolsMap = ToolSet;

// Instructions
import {
  NLQ_INSTRUCTIONS,
  ANALYST_INSTRUCTIONS,
  REPORTER_INSTRUCTIONS,
  ADVISOR_INSTRUCTIONS,
  VISION_INSTRUCTIONS,
} from './instructions';

// Model providers
import {
  getAdvisorModel,
  getAnalystModel,
  getNlqModel,
  getReporterModel,
  getVisionModel,
  type ModelResult,
} from './agent-model-selectors';
export type { ModelResult } from './agent-model-selectors';
import {
  EVALUATOR_AGENT_INSTRUCTIONS,
  OPTIMIZER_AGENT_INSTRUCTIONS,
} from './agent-pipeline-instructions';

// Tools (AI SDK tools)
import {
  // Server metrics tools
  getServerMetrics,
  getServerMetricsAdvanced,
  filterServers,
  getServerByGroup,
  getServerByGroupAdvanced,
  // Analysis tools
  detectAnomalies,
  detectAnomaliesAllServers,
  predictTrends,
  analyzePattern,
  correlateMetrics,
  findRootCause,
  // Reporting tools
  buildIncidentTimeline,
  // RAG tools
  searchKnowledgeBase,
  recommendCommands,
  // Web search
  searchWeb,
  // Incident evaluation tools (Evaluator-Optimizer pattern)
  evaluateIncidentReport,
  validateReportStructure,
  scoreRootCauseConfidence,
  refineRootCauseAnalysis,
  enhanceSuggestedActions,
  extendServerCorrelation,
  // Final answer (AI SDK v6 Best Practice)
  finalAnswer,
  // Vision tools (Gemini Flash-Lite)
  analyzeScreenshot,
} from '../../../../tools-ai-sdk';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Agent display name */
  name: string;
  /** Description for orchestrator routing decisions */
  description: string;
  /** Function to get model with fallback chain */
  getModel: () => ModelResult | null;
  /** Agent instructions (system prompt) */
  instructions: string;
  /** Available tools for the agent */
  tools: ToolsMap;
  /** Patterns for automatic routing */
  matchPatterns: (string | RegExp)[];
}

// ============================================================================
// Agent Configurations (SSOT)
// ============================================================================

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  'NLQ Agent': {
    name: 'NLQ Agent',
    description:
      '서버 상태 조회, CPU/메모리/디스크 메트릭 질의, 시간 범위 집계(지난 N시간 평균/최대), 서버 목록 확인 및 필터링, 상태 요약, 웹 검색을 처리합니다.',
    getModel: getNlqModel,
    instructions: NLQ_INSTRUCTIONS,
    tools: {
      getServerMetrics,
      getServerMetricsAdvanced,
      filterServers,
      getServerByGroup,
      getServerByGroupAdvanced,
      searchKnowledgeBase, // RAG: 트러블슈팅/장애 관련 지식 검색
      searchWeb,
      finalAnswer, // AI SDK v6 Best Practice: graceful loop termination
    },
    matchPatterns: [
      // Korean keywords
      '서버',
      '상태',
      '목록',
      '조회',
      '알려',
      '보여',
      // Metric types
      'cpu',
      'CPU',
      '메모리',
      'memory',
      '디스크',
      'disk',
      '네트워크',
      'network',
      // Time range keywords
      '지난',
      '시간',
      '전체',
      // Query patterns
      /\d+%/i,
      /이상|이하|초과|미만/i,
      /몇\s*개|몇\s*대/i,
      /평균|합계|최대|최소/i,
      /높은|낮은|많은|적은/i,
      /지난\s*\d+\s*시간/i,
      // Summary keywords (merged from Summarizer Agent)
      '요약',
      '간단히',
      '핵심',
      'TL;DR',
      'tldr',
      'summary',
      /요약.*해|간단.*알려/i,
      // Web search triggers
      '검색',
      'search',
      '찾아',
      '뭐야',
      '뭔가요',
      '알려줘',
      /에러|error|오류/i,
      /해결|solution|fix/i,
      /방법|how to/i,
    ],
  },

  'Analyst Agent': {
    name: 'Analyst Agent',
    description:
      '이상 탐지, 트렌드 예측, 패턴 분석, 근본 원인 분석(RCA), 상관관계 분석을 수행합니다. "왜?", "이상 있어?", "예측해줘" 질문에 적합합니다.',
    getModel: getAnalystModel,
    instructions: ANALYST_INSTRUCTIONS,
    tools: {
      getServerMetrics,
      getServerMetricsAdvanced,
      detectAnomalies,
      detectAnomaliesAllServers, // 전체 서버 이상치 스캔 (1회 호출로 15대 분석)
      predictTrends,
      analyzePattern,
      correlateMetrics,
      findRootCause,
      searchKnowledgeBase, // RAG: 과거 유사 장애 사례 조회
      finalAnswer, // AI SDK v6 Best Practice: graceful loop termination
    },
    matchPatterns: [
      // Anomaly keywords
      '이상',
      '비정상',
      'anomaly',
      '스파이크',
      'spike',
      // Prediction keywords
      '예측',
      '트렌드',
      '추세',
      '향후',
      'predict',
      // Analysis keywords
      '분석',
      '패턴',
      '원인',
      '왜',
      // Patterns
      /이상\s*(있|징후|탐지)/i,
      /언제.*될|고갈/i,
    ],
  },

  'Reporter Agent': {
    name: 'Reporter Agent',
    description:
      '장애 보고서 생성, 인시던트 타임라인 구성, 영향도 분석 보고서를 작성합니다. "보고서 만들어줘", "장애 정리" 요청에 적합합니다.',
    getModel: getReporterModel,
    instructions: REPORTER_INSTRUCTIONS,
    tools: {
      getServerMetrics,
      getServerMetricsAdvanced,
      filterServers,
      searchKnowledgeBase,
      searchWeb, // 에러 코드/CVE 조회용
      buildIncidentTimeline,
      findRootCause,
      correlateMetrics,
      finalAnswer, // AI SDK v6 Best Practice: graceful loop termination
    },
    matchPatterns: [
      // Report keywords
      '보고서',
      '리포트',
      'report',
      // Incident keywords
      '장애',
      '인시던트',
      'incident',
      '사고',
      // Timeline keywords
      '타임라인',
      'timeline',
      '시간순',
      // Summary keywords
      '정리',
      // Patterns
      /보고서.*만들|생성/i,
      /장애.*정리|요약/i,
    ],
  },

  'Advisor Agent': {
    name: 'Advisor Agent',
    description:
      '문제 해결 방법, CLI 명령어 추천, 과거 장애 사례 검색, 트러블슈팅 가이드, 웹 검색을 제공합니다. "어떻게 해결?", "명령어 알려줘" 질문에 적합합니다.',
    getModel: getAdvisorModel,
    instructions: ADVISOR_INSTRUCTIONS,
    tools: {
      searchKnowledgeBase,
      recommendCommands,
      searchWeb, // Added for external knowledge when RAG insufficient
      // Diagnostic tools for informed recommendations (P2 enhancement)
      findRootCause,
      correlateMetrics,
      detectAnomalies,
      finalAnswer, // AI SDK v6 Best Practice: graceful loop termination
    },
    matchPatterns: [
      // Solution keywords
      '해결',
      '방법',
      '어떻게',
      '조치',
      // Command keywords
      '명령어',
      'command',
      '실행',
      'cli',
      // Guide keywords
      '가이드',
      '도움',
      '추천',
      '안내',
      // History keywords
      '과거',
      '사례',
      '이력',
      '비슷한',
      '유사',
      // Patterns
      /어떻게.*해결|해결.*방법/i,
      /명령어.*알려|추천.*명령/i,
      /\?$/,
    ],
  },

  // =========================================================================
  // Evaluator-Optimizer Pattern Agents (for Reporter Pipeline)
  // =========================================================================

  // =========================================================================
  // Pipeline-Internal Agents (deterministic scoring, no LLM calls)
  //
  // Evaluator와 Optimizer는 reporter-pipeline.ts에서 결정론적으로 실행됩니다.
  // - Evaluator: 4차원 가중 평균 스코어링 (structure/completeness/accuracy/actionability)
  // - Optimizer: precomputed-state 히스토리 기반 근본원인 보강 + CLI 명령어 추가
  //
  // getModel은 AgentConfig 인터페이스 호환용으로 유지되지만, 실제 LLM 호출 없이
  // reporter-pipeline-score-utils.ts의 결정론적 함수들이 평가/개선을 수행합니다.
  // =========================================================================

  'Evaluator Agent': {
    name: 'Evaluator Agent',
    description:
      '[Pipeline-Internal, Deterministic] 생성된 장애 보고서의 품질을 결정론적으로 평가합니다. 구조 완성도, 내용 완성도, 근본원인 분석 정확도, 조치 실행가능성을 점수화합니다.',
    getModel: getNlqModel, // Interface 호환용 (실제 LLM 호출 없음)
    instructions: EVALUATOR_AGENT_INSTRUCTIONS,
    tools: {
      evaluateIncidentReport,
      validateReportStructure,
      scoreRootCauseConfidence,
    },
    matchPatterns: [], // 오케스트레이터에서 직접 호출만
  },

  'Optimizer Agent': {
    name: 'Optimizer Agent',
    description:
      '[Pipeline-Internal, Deterministic] 낮은 품질의 장애 보고서를 개선합니다. precomputed-state 히스토리 기반 근본원인 심화, CLI 명령어 추가, 서버 연관성 확장.',
    getModel: getAdvisorModel, // Interface 호환용 (실제 LLM 호출 없음)
    instructions: OPTIMIZER_AGENT_INSTRUCTIONS,
    tools: {
      refineRootCauseAnalysis,
      enhanceSuggestedActions,
      extendServerCorrelation,
      findRootCause,
      correlateMetrics,
    },
    matchPatterns: [], // 오케스트레이터에서 직접 호출만
  },

  // =========================================================================
  // Vision Agent (Gemini Flash → OpenRouter Fallback)
  // =========================================================================

  'Vision Agent': {
    name: 'Vision Agent',
    description:
      '대시보드 스크린샷 및 첨부 이미지 분석을 수행합니다. 이미지 기반의 시각 정보 추출에 적합합니다.',
    getModel: getVisionModel, // Gemini → OpenRouter fallback
    instructions: VISION_INSTRUCTIONS,
    tools: {
      // Vision-specific tools (Gemini Flash-Lite)
      analyzeScreenshot,
      finalAnswer, // AI SDK v6 Best Practice: graceful loop termination
    },
    matchPatterns: [
      // Screenshot/Image keywords
      '스크린샷',
      'screenshot',
      '이미지',
      'image',
      '사진',
      '차트',
      '그래프',
      '패널',
      // Dashboard keywords
      '대시보드',
      'dashboard',
      'grafana',
      'cloudwatch',
      'datadog',
      // Patterns
      /스크린샷.*분석|분석.*스크린샷/i,
      /이미지.*보여|첨부.*분석|시각.*분석/i,
    ],
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all agent names
 */
export function getAgentNames(): string[] {
  return Object.keys(AGENT_CONFIGS);
}

/**
 * Get agent config by name
 */
export function getAgentConfig(name: string): AgentConfig | undefined {
  return AGENT_CONFIGS[name];
}

/**
 * Check if agent is available (has valid model and is routable)
 * Agents with empty matchPatterns are internal-only (e.g., Evaluator, Optimizer)
 */
export function isAgentAvailable(name: string): boolean {
  const config = AGENT_CONFIGS[name];
  if (!config) return false;
  // Internal agents (matchPatterns: []) are not publicly available
  if (config.matchPatterns.length === 0) return false;
  return config.getModel() !== null;
}

/**
 * Get all available agents
 */
export function getAvailableAgents(): string[] {
  return Object.keys(AGENT_CONFIGS).filter(isAgentAvailable);
}
