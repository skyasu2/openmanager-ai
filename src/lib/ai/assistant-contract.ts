import {
  normalizeRouteDecision,
  type RouteDecision,
  type RouteDecisionArtifactKind,
  type RouteDecisionDecider,
  type RouteDecisionExecutionPath,
} from './route-decision';

export const ASSISTANT_CONTRACT_VERSION = '2026-05-03-v1';

export type AssistantPlanKind = 'chat' | 'artifact' | 'clarification';
export type AssistantResultKind = 'chat' | 'artifact' | 'error';
export type AssistantResultStatus = 'completed' | 'failed' | 'partial';

export interface AssistantPlan {
  kind: AssistantPlanKind;
  planVersion: string;
  routeDecision: RouteDecision;
  executionPath: RouteDecisionExecutionPath;
  stream: boolean;
  job: boolean;
  artifactKind?: RouteDecisionArtifactKind;
  reasonCodes: string[];
  dataSlot?: string;
  traceId?: string;
  decidedBy: RouteDecisionDecider;
}

export interface AssistantResult {
  kind: AssistantResultKind;
  resultVersion: string;
  routeDecision?: RouteDecision;
  status: AssistantResultStatus;
  artifactKind?: RouteDecisionArtifactKind;
  traceId?: string;
  errorCode?: string;
}

type BuildAssistantPlanOverrides = Partial<
  Omit<
    AssistantPlan,
    | 'kind'
    | 'planVersion'
    | 'routeDecision'
    | 'executionPath'
    | 'stream'
    | 'job'
    | 'reasonCodes'
    | 'decidedBy'
  >
> & {
  kind?: AssistantPlanKind;
  planVersion?: string;
  stream?: boolean;
  job?: boolean;
};

type BuildAssistantResultOverrides = Partial<
  Omit<AssistantResult, 'kind' | 'resultVersion' | 'routeDecision' | 'status'>
> & {
  kind?: AssistantResultKind;
  resultVersion?: string;
  status?: AssistantResultStatus;
};

const PLAN_KINDS = new Set<AssistantPlanKind>([
  'chat',
  'artifact',
  'clarification',
]);
const RESULT_KINDS = new Set<AssistantResultKind>([
  'chat',
  'artifact',
  'error',
]);
const RESULT_STATUSES = new Set<AssistantResultStatus>([
  'completed',
  'failed',
  'partial',
]);
const EXECUTION_PATHS = new Set<RouteDecisionExecutionPath>([
  'stream',
  'job',
  'client-artifact',
]);
const ARTIFACT_KINDS = new Set<RouteDecisionArtifactKind>([
  'server-snapshot',
  'incident-report',
  'monitoring-analysis',
]);
const DECIDERS = new Set<RouteDecisionDecider>([
  'frontend',
  'bff',
  'cloud-run',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function fromSet<T extends string>(
  value: unknown,
  allowed: Set<T>
): T | undefined {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

function normalizeReasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(nonEmptyString)
    .filter((item): item is string => item !== undefined);
}

function inferPlanKind(routeDecision: RouteDecision): AssistantPlanKind {
  if (routeDecision.intent === 'artifact') return 'artifact';
  if (routeDecision.intent === 'clarification') return 'clarification';
  return 'chat';
}

function inferResultKind(
  routeDecision: RouteDecision,
  status: AssistantResultStatus
): AssistantResultKind {
  if (status === 'failed') return 'error';
  if (routeDecision.intent === 'artifact') return 'artifact';
  return 'chat';
}

export function buildAssistantPlanFromRouteDecision(
  routeDecision: RouteDecision,
  overrides: BuildAssistantPlanOverrides = {}
): AssistantPlan {
  const executionPath = routeDecision.executionPath;
  return {
    kind: overrides.kind ?? inferPlanKind(routeDecision),
    planVersion: overrides.planVersion ?? ASSISTANT_CONTRACT_VERSION,
    routeDecision,
    executionPath,
    stream: overrides.stream ?? executionPath === 'stream',
    job: overrides.job ?? executionPath === 'job',
    ...((overrides.artifactKind ?? routeDecision.artifactKind)
      ? { artifactKind: overrides.artifactKind ?? routeDecision.artifactKind }
      : {}),
    reasonCodes: [...routeDecision.reasonCodes],
    ...((overrides.dataSlot ?? routeDecision.dataSlot)
      ? { dataSlot: overrides.dataSlot ?? routeDecision.dataSlot }
      : {}),
    ...((overrides.traceId ?? routeDecision.traceId)
      ? { traceId: overrides.traceId ?? routeDecision.traceId }
      : {}),
    decidedBy: routeDecision.decidedBy,
  };
}

export function buildAssistantResultFromRouteDecision(
  routeDecision: RouteDecision,
  overrides: BuildAssistantResultOverrides = {}
): AssistantResult {
  const status = overrides.status ?? 'completed';
  return {
    kind: overrides.kind ?? inferResultKind(routeDecision, status),
    resultVersion: overrides.resultVersion ?? ASSISTANT_CONTRACT_VERSION,
    routeDecision,
    status,
    ...((overrides.artifactKind ?? routeDecision.artifactKind)
      ? { artifactKind: overrides.artifactKind ?? routeDecision.artifactKind }
      : {}),
    ...((overrides.traceId ?? routeDecision.traceId)
      ? { traceId: overrides.traceId ?? routeDecision.traceId }
      : {}),
    ...(overrides.errorCode && { errorCode: overrides.errorCode }),
  };
}

export function normalizeAssistantPlan(
  value: unknown
): AssistantPlan | undefined {
  if (!isRecord(value)) return undefined;

  const kind = fromSet(value.kind, PLAN_KINDS);
  const routeDecision = normalizeRouteDecision(value.routeDecision);
  const executionPath = fromSet(value.executionPath, EXECUTION_PATHS);
  const decidedBy = fromSet(value.decidedBy, DECIDERS);
  if (!kind || !routeDecision || !executionPath || !decidedBy) {
    return undefined;
  }
  if (typeof value.stream !== 'boolean' || typeof value.job !== 'boolean') {
    return undefined;
  }

  const artifactKind = fromSet(value.artifactKind, ARTIFACT_KINDS);
  const planVersion =
    nonEmptyString(value.planVersion) ?? ASSISTANT_CONTRACT_VERSION;
  const dataSlot = nonEmptyString(value.dataSlot);
  const traceId = nonEmptyString(value.traceId);

  return {
    kind,
    planVersion,
    routeDecision,
    executionPath,
    stream: value.stream,
    job: value.job,
    ...(artifactKind && { artifactKind }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    ...(dataSlot && { dataSlot }),
    ...(traceId && { traceId }),
    decidedBy,
  };
}

export function normalizeAssistantResult(
  value: unknown
): AssistantResult | undefined {
  if (!isRecord(value)) return undefined;

  const kind = fromSet(value.kind, RESULT_KINDS);
  const status = fromSet(value.status, RESULT_STATUSES);
  if (!kind || !status) return undefined;

  const routeDecision =
    value.routeDecision === undefined
      ? undefined
      : normalizeRouteDecision(value.routeDecision);
  if (value.routeDecision !== undefined && !routeDecision) {
    return undefined;
  }

  const artifactKind = fromSet(value.artifactKind, ARTIFACT_KINDS);
  const resultVersion =
    nonEmptyString(value.resultVersion) ?? ASSISTANT_CONTRACT_VERSION;
  const traceId = nonEmptyString(value.traceId);
  const errorCode = nonEmptyString(value.errorCode);

  return {
    kind,
    resultVersion,
    ...(routeDecision && { routeDecision }),
    status,
    ...(artifactKind && { artifactKind }),
    ...(traceId && { traceId }),
    ...(errorCode && { errorCode }),
  };
}
