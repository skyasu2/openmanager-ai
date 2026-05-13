import { normalizeAgentRuntimeName } from '../../../core/assistant-runtime/agent-name-compat';

export type LatencyTier = 'fast' | 'normal' | 'slow' | 'very_slow';

interface RequiredPatternRule {
  pattern: RegExp;
  flag: string;
}

interface DetectedPatternRule {
  pattern: RegExp;
  flag: string;
}

interface AgentResponsePolicy {
  minChars: number;
  maxChars: number;
  requiredPatterns?: RequiredPatternRule[];
}

const DEFAULT_POLICY: AgentResponsePolicy = {
  minChars: 120,
  maxChars: 4000,
};

const COMMON_DETECTED_PATTERNS: DetectedPatternRule[] = [
  { pattern: /[一-鿿]/, flag: 'CONTAINS_CHINESE_CHARS' },
];

const CONFIDENCE_SCORE_PATTERN =
  /(?:\*\*)?(?:신뢰도|confidence)(?:\*\*)?\s*[:：]\s*\d{1,3}(?:\.\d+)?%/i;

const AGENT_RESPONSE_POLICIES: Record<string, AgentResponsePolicy> = {
  'Metrics Query Agent': {
    minChars: 140,
    maxChars: 2500,
    requiredPatterns: [
      { pattern: /\d{1,3}(?:\.\d+)?%/, flag: 'MISSING_METRIC_EVIDENCE' },
      { pattern: /(권고|조치|요약|권장|없습니다|정상)/, flag: 'MISSING_ACTION_GUIDANCE' },
      // 서버명/ID 또는 전체 서버 수량 등 실제 서버 범위를 확인
      {
        pattern: /[a-z]+-[a-z]+-\w+\d|서버\s*\d+대|전체\s*\d+대|\d+대\s*(서버|중)/,
        flag: 'MISSING_SERVER_REFERENCE',
      },
    ],
  },
  'Analyst Agent': {
    minChars: 220,
    maxChars: 2800,
    requiredPatterns: [
      { pattern: /(현황|요약)/, flag: 'MISSING_SCENARIO_OVERVIEW' },
      { pattern: /\d{1,3}(?:\.\d+)?%/, flag: 'MISSING_PERCENT_EVIDENCE' },
      { pattern: /(원인|가설|추정 원인|신뢰도)/, flag: 'MISSING_CAUSE_HYPOTHESIS' },
      { pattern: CONFIDENCE_SCORE_PATTERN, flag: 'MISSING_CONFIDENCE_SCORE' },
      { pattern: /(→|유발|전파|인과|원인.*결과)/, flag: 'MISSING_CAUSAL_DIRECTION' },
      { pattern: /(조치|권장)/, flag: 'MISSING_ACTION_SECTION' },
    ],
  },
  'Reporter Agent': {
    minChars: 280,
    maxChars: 4200,
    requiredPatterns: [
      { pattern: /(##\s*개요|##\s*영향 범위|##\s*타임라인|###\s*개요|###\s*근본 원인)/, flag: 'MISSING_REPORT_SECTIONS' },
      { pattern: /(권장|재발|조치|권고)/, flag: 'MISSING_ACTION_SECTION' },
      { pattern: /(영향|사이드|재현|영향도)/, flag: 'MISSING_IMPACT_EVIDENCE' },
      { pattern: CONFIDENCE_SCORE_PATTERN, flag: 'MISSING_CONFIDENCE_SCORE' },
    ],
  },
  'Advisor Agent': {
    minChars: 190,
    maxChars: 2600,
    requiredPatterns: [
      { pattern: /`[^`]+`/, flag: 'MISSING_COMMAND_BLOCK' },
      { pattern: /(진단|조치|확인|권장)/, flag: 'MISSING_STEP_GUIDE' },
      { pattern: /(문제|원인|해결)/, flag: 'MISSING_PROBLEM_CONTEXT' },
    ],
  },
  'Vision Agent': {
    minChars: 210,
    maxChars: 3200,
    requiredPatterns: [
      { pattern: /(주요 발견사항|추정 원인|권장 조치|구조|트렌드)/, flag: 'MISSING_VISUAL_FINDINGS' },
      { pattern: /(권장|조치)/, flag: 'MISSING_ACTION_SECTION' },
      { pattern: /(분석|근거|로그|메트릭)/, flag: 'MISSING_ANALYSIS_EVIDENCE' },
    ],
  },
};

export interface ResponseQualityMetrics {
  responseChars: number;
  formatCompliance: boolean;
  qualityFlags: string[];
  latencyTier: LatencyTier;
}

function getAgentResponsePolicy(agentName: string): AgentResponsePolicy {
  const normalizedAgentName = normalizeAgentRuntimeName(agentName);
  return AGENT_RESPONSE_POLICIES[normalizedAgentName] ?? DEFAULT_POLICY;
}

function isConciseGroundedMetricAnswer(text: string): boolean {
  return (
    /\b(?:lb|web|api|was|db|cache|storage|backup|monitoring|worker)-[a-z0-9-]+/i.test(text) &&
    /\d{1,3}(?:\.\d+)?%/.test(text)
  );
}

// Advisor Agent uses Mistral + multiple tool calls — observed 35~86s in production.
// Separate thresholds prevent false VERY_SLOW flags for structurally slow agents.
const ADVISOR_LATENCY_THRESHOLDS = { fast: 8_000, normal: 20_000, slow: 40_000 };

export function classifyLatencyTier(durationMs: number, agentName: string): LatencyTier {
  if (agentName === 'Advisor Agent') {
    const t = ADVISOR_LATENCY_THRESHOLDS;
    if (durationMs <= t.fast) return 'fast';
    if (durationMs <= t.normal) return 'normal';
    if (durationMs <= t.slow) return 'slow';
    return 'very_slow';
  }

  const isHeavyAgent =
    agentName === 'Reporter Agent' ||
    agentName === 'Vision Agent' ||
    agentName === 'Analyst Agent';

  const fastThreshold = isHeavyAgent ? 5000 : 3000;
  const normalThreshold = isHeavyAgent ? 13000 : 8000;
  const slowThreshold = isHeavyAgent ? 25000 : 18000;

  if (durationMs <= fastThreshold) return 'fast';
  if (durationMs <= normalThreshold) return 'normal';
  if (durationMs <= slowThreshold) return 'slow';
  return 'very_slow';
}

export function evaluateAgentResponseQuality(
  agentName: string,
  text: string,
  options: {
    durationMs: number;
    fallbackReason?: string;
  }
): ResponseQualityMetrics {
  const normalized = text.trim();
  const responseChars = normalized.length;
  const qualityFlags: string[] = [];
  const policy = getAgentResponsePolicy(agentName);

  if (responseChars === 0) {
    qualityFlags.push('EMPTY_RESPONSE');
  } else if (
    responseChars < policy.minChars &&
    !isConciseGroundedMetricAnswer(normalized)
  ) {
    qualityFlags.push('TOO_SHORT');
  }

  if (responseChars > policy.maxChars) {
    qualityFlags.push('TOO_LONG');
  }

  if (policy.requiredPatterns) {
    for (const rule of policy.requiredPatterns) {
      if (!rule.pattern.test(normalized)) {
        qualityFlags.push(rule.flag);
      }
    }
  }

  for (const rule of COMMON_DETECTED_PATTERNS) {
    if (rule.pattern.test(normalized) && !qualityFlags.includes(rule.flag)) {
      qualityFlags.push(rule.flag);
    }
  }

  if (options.fallbackReason && !qualityFlags.includes(options.fallbackReason)) {
    qualityFlags.push(options.fallbackReason);
  }

  const latencyTier = classifyLatencyTier(options.durationMs, agentName);
  if (latencyTier === 'slow') {
    qualityFlags.push('LATENCY_SLOW');
  } else if (latencyTier === 'very_slow') {
    qualityFlags.push('LATENCY_VERY_SLOW');
  }

  const formatFlags = qualityFlags.filter(
    (flag) =>
      flag === 'EMPTY_RESPONSE' ||
      flag === 'TOO_SHORT' ||
      flag === 'TOO_LONG' ||
      flag.startsWith('MISSING_')
  );

  return {
    responseChars,
    formatCompliance: formatFlags.length === 0,
    qualityFlags,
    latencyTier,
  };
}
