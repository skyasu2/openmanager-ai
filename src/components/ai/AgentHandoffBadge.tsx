/**
 * Agent Handoff Badge
 *
 * Displays agent transition information in a visually appealing badge.
 * Parses handoff markers from the AI stream and renders them as badges.
 *
 * Pattern matched: 🔄 **FromAgent** → **ToAgent**: reason
 *
 * @version 1.0.0
 * @created 2026-01-18
 */

import {
  ArrowRight,
  Bot,
  Cpu,
  FileText,
  HelpCircle,
  Search,
} from 'lucide-react';
import { memo } from 'react';

interface AgentHandoffBadgeProps {
  /** Source agent name */
  from: string;
  /** Target agent name */
  to: string;
  /** Optional reason for handoff */
  reason?: string;
  /** Compact mode for inline display */
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
};

// Agent name to color mapping
const AGENT_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Orchestrator: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  'OpenManager Orchestrator': {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  'NLQ Agent': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'Analyst Agent': {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  'Reporter Agent': {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  'Advisor Agent': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
};

const DEFAULT_COLOR = {
  bg: 'bg-gray-50',
  text: 'text-gray-700',
  border: 'border-gray-200',
};

/**
 * Parse handoff marker from text
 * Pattern: 🔄 **FromAgent** → **ToAgent**: reason
 */
export function parseHandoffMarker(
  text: string
): AgentHandoffBadgeProps | null {
  const pattern = /🔄\s*\*\*([^*]+)\*\*\s*→\s*\*\*([^*]+)\*\*\s*(?::\s*(.+))?/;
  const match = text.match(pattern);

  if (!match?.[1] || !match?.[2]) return null;

  return {
    from: match[1].trim(),
    to: match[2].trim(),
    reason: match[3]?.trim(),
  };
}

/**
 * Check if text contains a handoff marker
 */
export function containsHandoffMarker(text: string): boolean {
  return /🔄\s*\*\*[^*]+\*\*\s*→\s*\*\*[^*]+\*\*/.test(text);
}

/**
 * Agent Handoff Badge Component
 */
export const AgentHandoffBadge = memo<AgentHandoffBadgeProps>(
  ({ from, to, reason, compact = false }) => {
    const FromIcon = AGENT_ICONS[from] || Bot;
    const ToIcon = AGENT_ICONS[to] || Bot;
    const fromColor = AGENT_COLORS[from] || DEFAULT_COLOR;
    const toColor = AGENT_COLORS[to] || DEFAULT_COLOR;

    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          <FromIcon className="h-3 w-3" />
          <ArrowRight className="h-2.5 w-2.5 text-gray-400" />
          <ToIcon className="h-3 w-3" />
          <span>{to}</span>
        </span>
      );
    }

    return (
      <div className="my-3 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gradient-to-r from-gray-50 to-white px-4 py-2 shadow-sm">
          {/* From Agent */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${fromColor.bg} ${fromColor.text} ${fromColor.border}`}
          >
            <FromIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{from}</span>
          </div>

          {/* Arrow */}
          <ArrowRight className="h-4 w-4 text-gray-400" />

          {/* To Agent */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${toColor.bg} ${toColor.text} ${toColor.border}`}
          >
            <ToIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{to}</span>
          </div>

          {/* Reason (if provided) */}
          {reason && (
            <>
              <span className="text-xs text-gray-400">:</span>
              <span className="max-w-tooltip truncate text-xs text-gray-500">
                {reason}
              </span>
            </>
          )}
        </div>
      </div>
    );
  }
);

AgentHandoffBadge.displayName = 'AgentHandoffBadge';
