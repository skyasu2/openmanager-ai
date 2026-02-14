/**
 * Agent Status Indicator
 *
 * Displays real-time agent status changes during AI streaming.
 * Shows thinking, processing, and completed states with animations.
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import {
  Bot,
  Cpu,
  Eye,
  FileText,
  HelpCircle,
  Loader2,
  Search,
  Settings,
} from 'lucide-react';
import { memo } from 'react';

export type AgentStatus = 'thinking' | 'processing' | 'completed' | 'idle';

export interface AgentStatusIndicatorProps {
  /** Agent name */
  agent: string;
  /** Current status */
  status: AgentStatus;
  /** Compact inline mode */
  compact?: boolean;
}

// Agent name to icon mapping
const AGENT_ICONS: Record<string, typeof Bot> = {
  Orchestrator: Bot,
  'OpenManager Orchestrator': Bot,
  'NLQ Agent': Search,
  'Analyst Agent': Cpu,
  'Reporter Agent': FileText,
  'Advisor Agent': HelpCircle,
  'Vision Agent': Eye,
  Evaluator: Settings,
  Optimizer: Settings,
};

// Agent Korean descriptions
const AGENT_DESCRIPTIONS: Record<string, string> = {
  Orchestrator: '최적 에이전트를 선택하고 있습니다',
  'OpenManager Orchestrator': '최적 에이전트를 선택하고 있습니다',
  'NLQ Agent': '서버 데이터를 조회하고 있습니다',
  'Analyst Agent': '패턴을 분석하고 있습니다',
  'Reporter Agent': '보고서를 작성하고 있습니다',
  'Advisor Agent': '지식 베이스를 검색하고 있습니다',
  'Vision Agent': '이미지를 분석하고 있습니다',
  Evaluator: '결과를 평가하고 있습니다',
  Optimizer: '응답을 최적화하고 있습니다',
};

// Status to color/animation mapping
const STATUS_STYLES: Record<
  AgentStatus,
  { bg: string; text: string; border: string; animate?: string }
> = {
  thinking: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    animate: 'animate-pulse',
  },
  processing: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  completed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  idle: {
    bg: 'bg-gray-50',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
};

// Status labels (Korean)
const STATUS_LABELS: Record<AgentStatus, string> = {
  thinking: '분석 중...',
  processing: '처리 중...',
  completed: '완료',
  idle: '대기',
};

/**
 * Parse agent_status event data
 */
export function parseAgentStatus(
  data: unknown
): { agent: string; status: AgentStatus } | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;
  if (typeof obj.agent !== 'string') return null;

  const status = obj.status as string;
  if (!['thinking', 'processing', 'completed', 'idle'].includes(status)) {
    return null;
  }

  return {
    agent: obj.agent,
    status: status as AgentStatus,
  };
}

/**
 * Agent Status Indicator Component
 */
export const AgentStatusIndicator = memo<AgentStatusIndicatorProps>(
  ({ agent, status, compact = false }) => {
    const Icon = AGENT_ICONS[agent] || Bot;
    const style = STATUS_STYLES[status];
    const label = STATUS_LABELS[status];

    const description = AGENT_DESCRIPTIONS[agent];

    if (compact) {
      return (
        <div
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium ${style.bg} ${style.text} ${style.border} border ${style.animate || ''}`}
        >
          {(status === 'thinking' || status === 'processing') && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          <Icon className="h-3.5 w-3.5" />
          <span className="font-semibold">{agent}</span>
          {description && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-normal opacity-75">{description}</span>
            </>
          )}
        </div>
      );
    }

    return (
      <div
        className={`my-2 flex items-center justify-center ${style.animate || ''}`}
      >
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${style.bg} ${style.text} ${style.border}`}
        >
          {(status === 'thinking' || status === 'processing') && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <Icon className="h-4 w-4" />
          <span className="text-sm font-medium">{agent}</span>
          <span className="text-xs opacity-75">• {label}</span>
        </div>
      </div>
    );
  }
);

AgentStatusIndicator.displayName = 'AgentStatusIndicator';

export default AgentStatusIndicator;
