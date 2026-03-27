export type LatencyTier = 'fast' | 'normal' | 'slow' | 'very_slow';

interface RequiredPatternRule {
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

const AGENT_RESPONSE_POLICIES: Record<string, AgentResponsePolicy> = {
  'NLQ Agent': {
    minChars: 140,
    maxChars: 2500,
    requiredPatterns: [
      { pattern: /\d{1,3}(?:\.\d+)?%/, flag: 'MISSING_METRIC_EVIDENCE' },
      { pattern: /(권고|조치|요약)/, flag: 'MISSING_ACTION_GUIDANCE' },
      { pattern: /(\u{1F4CA}|\ud83d\udca1|서버 현황 요약|⚠️)/u, flag: 'MISSING_STATUS_STRUCTURE' },
    ],
  },
  'Analyst Agent': {
    minChars: 220,
    maxChars: 2800,
    requiredPatterns: [
      { pattern: /(현황|요약)/, flag: 'MISSING_SCENARIO_OVERVIEW' },
      { pattern: /\d{1,3}(?:\.\d+)?%/, flag: 'MISSING_PERCENT_EVIDENCE' },
      { pattern: /(원인|가설|추정 원인|신뢰도)/, flag: 'MISSING_CAUSE_HYPOTHESIS' },
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
  return AGENT_RESPONSE_POLICIES[agentName] ?? DEFAULT_POLICY;
}

export function classifyLatencyTier(durationMs: number, agentName: string): LatencyTier {
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
  } else if (responseChars < policy.minChars) {
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
