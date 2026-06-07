import type { QueryStatus } from '../../services/ai-sdk/agents/orchestrator-query-intent';

export function resolveExplicitStatusFilter(
  message: string,
  statusValue: QueryStatus | undefined
): QueryStatus | undefined {
  const explicitStatus = statusValue ?? inferExplicitStatusValue(message);
  if (!explicitStatus) return undefined;
  return hasExplicitStatusContext(message) ? explicitStatus : undefined;
}

function inferExplicitStatusValue(message: string): QueryStatus | undefined {
  if (/offline|오프라인/i.test(message)) return 'offline';
  if (/critical|위험/i.test(message)) return 'critical';
  if (/warning|경고/i.test(message)) return 'warning';
  if (/online|온라인|정상/i.test(message)) return 'online';
  return undefined;
}

function hasExplicitStatusContext(message: string): boolean {
  const statusToken =
    '(?:online|warning|critical|offline|온라인|정상|경고|위험|오프라인)';
  const statusWordContext = new RegExp(
    `(?:상태|status).{0,16}${statusToken}|${statusToken}.{0,16}(?:상태|status|서버|server)`,
    'i'
  );
  if (statusWordContext.test(message)) return true;

  const countComparisonContext = new RegExp(
    `${statusToken}.{0,20}(?:수|개수|몇|많|적|카운트|count)|(?:수|개수|몇|많|적|카운트|count).{0,20}${statusToken}`,
    'i'
  );
  return countComparisonContext.test(message);
}

export function isTopBottomServerHealthMessage(message: string): boolean {
  return (
    /서버|server/i.test(message) &&
    /위험|위험도|불안정|문제|비정상|critical|risk|unstable|problematic|unhealthy/i.test(
      message
    ) &&
    /안정|정상|안전|괜찮|healthy|stable|safe|lowest\s+risk|least\s+risk/i.test(
      message
    ) &&
    /같이|함께|동시|둘\s*다|모두|와|과|그리고|및|\+|both|and/i.test(message)
  );
}
