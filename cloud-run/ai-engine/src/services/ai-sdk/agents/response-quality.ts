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
  minChars: 40,
  maxChars: 4000,
};

const AGENT_RESPONSE_POLICIES: Record<string, AgentResponsePolicy> = {
  'NLQ Agent': {
    minChars: 100,
    maxChars: 1800,
  },
  'Analyst Agent': {
    minChars: 140,
    maxChars: 2200,
    requiredPatterns: [
      { pattern: /\d{1,3}(?:\.\d+)?%/, flag: 'MISSING_PERCENT_EVIDENCE' },
      { pattern: /(원인|가설|신뢰도)/, flag: 'MISSING_CAUSE_HYPOTHESIS' },
    ],
  },
  'Reporter Agent': {
    minChars: 220,
    maxChars: 3000,
    requiredPatterns: [
      { pattern: /(^|\n)#{2,3}\s/, flag: 'MISSING_MARKDOWN_STRUCTURE' },
      { pattern: /(권장|조치|재발 방지)/, flag: 'MISSING_ACTION_SECTION' },
    ],
  },
  'Advisor Agent': {
    minChars: 160,
    maxChars: 2400,
    requiredPatterns: [
      { pattern: /`[^`]+`/, flag: 'MISSING_COMMAND_BLOCK' },
      { pattern: /(진단|조치|확인|권장)/, flag: 'MISSING_STEP_GUIDE' },
    ],
  },
  'Vision Agent': {
    minChars: 180,
    maxChars: 2600,
    requiredPatterns: [
      { pattern: /(분석|발견|이상|트렌드)/, flag: 'MISSING_VISUAL_FINDINGS' },
      { pattern: /(권장|조치)/, flag: 'MISSING_ACTION_SECTION' },
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
