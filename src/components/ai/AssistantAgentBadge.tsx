import type { ResponseHandoff } from '@/stores/useAISidebarStore';
import { getAgentRoleLabel } from './analysis-basis/shared';

interface AssistantAgentBadgeProps {
  handoffHistory?: ResponseHandoff[];
  className?: string;
}

export function resolveAssistantAgentLabel(
  handoffHistory?: ResponseHandoff[]
): string | null {
  if (!handoffHistory || handoffHistory.length === 0) {
    return null;
  }

  for (let index = handoffHistory.length - 1; index >= 0; index -= 1) {
    const target = handoffHistory[index]?.to?.trim();
    if (target) {
      return getAgentRoleLabel(target);
    }
  }

  return null;
}

export function AssistantAgentBadge({
  handoffHistory,
  className = '',
}: AssistantAgentBadgeProps) {
  const label = resolveAssistantAgentLabel(handoffHistory);

  if (!label) {
    return null;
  }

  return (
    <span
      data-testid="assistant-agent-badge"
      title={`응답 에이전트: ${label}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ${className}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      <span className="truncate">{label}</span>
    </span>
  );
}
