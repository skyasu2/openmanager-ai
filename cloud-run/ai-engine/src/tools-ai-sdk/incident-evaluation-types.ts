export interface EvaluationInputReport {
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
  structure: number;
  completeness: number;
  accuracy: number;
  actionability: number;
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
