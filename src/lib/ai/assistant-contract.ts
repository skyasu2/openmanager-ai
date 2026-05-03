import {
  normalizeRouteDecision,
  type RouteDecision,
  type RouteDecisionArtifactKind,
  type RouteDecisionDecider,
  type RouteDecisionExecutionPath,
  type RouteDecisionMode,
} from './route-decision';

export const ASSISTANT_CONTRACT_VERSION = '2026-05-03-v1';

export type AssistantPlanKind = 'chat' | 'artifact' | 'clarification';
export type AssistantResultKind = 'chat' | 'artifact' | 'error';
export type AssistantResultStatus = 'completed' | 'failed' | 'partial';
export type AssistantExecutionMode =
  | 'deterministic'
  | 'single-agent'
  | 'multi-agent';
export type MultiAgentEscalationReasonCode =
  | 'rca_requested'
  | 'incident_report_requested'
  | 'cross_domain_evidence_required'
  | 'advisor_requested'
  | 'vision_input_present'
  | 'analysis_mode_thinking'
  | 'single_path_low_confidence';
export type AssistantPlannerDriftReasonCode =
  | 'execution_path_mismatch'
  | 'execution_mode_mismatch'
  | 'artifact_kind_mismatch'
  | 'reason_code_mismatch'
  | 'local_decision_missing'
  | 'shadow_plan_unavailable';

export type AssistantPlannerShadowCandidate = {
  kind: AssistantPlanKind;
  executionPath: RouteDecisionExecutionPath;
  executionMode: AssistantExecutionMode;
  artifactKind?: RouteDecisionArtifactKind;
  reasonCodes: string[];
  escalationReasonCodes?: MultiAgentEscalationReasonCode[];
  decidedBy: RouteDecisionDecider;
};

export type AssistantPlannerShadowLocalDecision = {
  executionPath: RouteDecisionExecutionPath;
  mode?: RouteDecisionMode;
  reasonCodes: string[];
  decidedBy: RouteDecisionDecider;
};

export type AssistantPlannerShadowDrift = {
  matched: boolean;
  reasonCodes: AssistantPlannerDriftReasonCode[];
};

export type AssistantPlannerShadow = {
  plannerVersion?: string;
  candidate: AssistantPlannerShadowCandidate;
  localDecision?: AssistantPlannerShadowLocalDecision;
  drift?: AssistantPlannerShadowDrift;
  latencyMs?: number;
};

export interface AssistantPlan {
  kind: AssistantPlanKind;
  planVersion: string;
  routeDecision: RouteDecision;
  executionPath: RouteDecisionExecutionPath;
  executionMode?: AssistantExecutionMode;
  stream: boolean;
  job: boolean;
  artifactKind?: RouteDecisionArtifactKind;
  reasonCodes: string[];
  escalationReasonCodes?: MultiAgentEscalationReasonCode[];
  plannerShadow?: AssistantPlannerShadow;
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
const EXECUTION_MODES = new Set<AssistantExecutionMode>([
  'deterministic',
  'single-agent',
  'multi-agent',
]);
const EXECUTION_PATHS = new Set<RouteDecisionExecutionPath>([
  'stream',
  'job',
  'client-artifact',
]);
const ROUTE_MODES = new Set<RouteDecisionMode>(['single', 'multi']);
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
const ESCALATION_REASON_CODES = new Set<MultiAgentEscalationReasonCode>([
  'rca_requested',
  'incident_report_requested',
  'cross_domain_evidence_required',
  'advisor_requested',
  'vision_input_present',
  'analysis_mode_thinking',
  'single_path_low_confidence',
]);
const PLANNER_DRIFT_REASON_CODES = new Set<AssistantPlannerDriftReasonCode>([
  'execution_path_mismatch',
  'execution_mode_mismatch',
  'artifact_kind_mismatch',
  'reason_code_mismatch',
  'local_decision_missing',
  'shadow_plan_unavailable',
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

function normalizeCodesFromSet<T extends string>(
  value: unknown,
  allowed: Set<T>
): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is T => typeof item === 'string' && allowed.has(item as T)
  );
}

function finiteNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
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

function inferExecutionMode(
  routeDecision: RouteDecision
): AssistantExecutionMode | undefined {
  if (routeDecision.executionPath === 'client-artifact') {
    return 'deterministic';
  }
  if (routeDecision.mode === 'multi') {
    return 'multi-agent';
  }
  if (routeDecision.mode === 'single') {
    return 'single-agent';
  }
  return undefined;
}

function normalizePlannerShadowCandidate(
  value: unknown
): AssistantPlannerShadowCandidate | undefined {
  if (!isRecord(value)) return undefined;

  const kind = fromSet(value.kind, PLAN_KINDS);
  const executionPath = fromSet(value.executionPath, EXECUTION_PATHS);
  const executionMode = fromSet(value.executionMode, EXECUTION_MODES);
  const decidedBy = fromSet(value.decidedBy, DECIDERS);
  if (!kind || !executionPath || !executionMode || !decidedBy) {
    return undefined;
  }

  const artifactKind = fromSet(value.artifactKind, ARTIFACT_KINDS);
  const escalationReasonCodes = normalizeCodesFromSet(
    value.escalationReasonCodes,
    ESCALATION_REASON_CODES
  );

  return {
    kind,
    executionPath,
    executionMode,
    ...(artifactKind && { artifactKind }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    ...(escalationReasonCodes.length > 0 && { escalationReasonCodes }),
    decidedBy,
  };
}

function normalizePlannerShadowLocalDecision(
  value: unknown
): AssistantPlannerShadowLocalDecision | undefined {
  if (!isRecord(value)) return undefined;

  const executionPath = fromSet(value.executionPath, EXECUTION_PATHS);
  const mode = fromSet(value.mode, ROUTE_MODES);
  const decidedBy = fromSet(value.decidedBy, DECIDERS);
  if (!executionPath || !decidedBy) {
    return undefined;
  }

  return {
    executionPath,
    ...(mode && { mode }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    decidedBy,
  };
}

function normalizePlannerShadowDrift(
  value: unknown
): AssistantPlannerShadowDrift | undefined {
  if (!isRecord(value) || typeof value.matched !== 'boolean') {
    return undefined;
  }

  return {
    matched: value.matched,
    reasonCodes: normalizeCodesFromSet(
      value.reasonCodes,
      PLANNER_DRIFT_REASON_CODES
    ),
  };
}

function normalizePlannerShadow(
  value: unknown
): AssistantPlannerShadow | undefined {
  if (!isRecord(value)) return undefined;

  const candidate = normalizePlannerShadowCandidate(value.candidate);
  if (!candidate) return undefined;

  const plannerVersion = nonEmptyString(value.plannerVersion);
  const localDecision = normalizePlannerShadowLocalDecision(
    value.localDecision
  );
  const drift = normalizePlannerShadowDrift(value.drift);
  const latencyMs = finiteNonNegativeInteger(value.latencyMs);

  return {
    ...(plannerVersion && { plannerVersion }),
    candidate,
    ...(localDecision && { localDecision }),
    ...(drift && { drift }),
    ...(latencyMs !== undefined && { latencyMs }),
  };
}

export function buildAssistantPlanFromRouteDecision(
  routeDecision: RouteDecision,
  overrides: BuildAssistantPlanOverrides = {}
): AssistantPlan {
  const executionPath = routeDecision.executionPath;
  const executionMode =
    overrides.executionMode ?? inferExecutionMode(routeDecision);
  const escalationReasonCodes = normalizeCodesFromSet(
    overrides.escalationReasonCodes,
    ESCALATION_REASON_CODES
  );
  const plannerShadow = normalizePlannerShadow(overrides.plannerShadow);
  return {
    kind: overrides.kind ?? inferPlanKind(routeDecision),
    planVersion: overrides.planVersion ?? ASSISTANT_CONTRACT_VERSION,
    routeDecision,
    executionPath,
    ...(executionMode && { executionMode }),
    stream: overrides.stream ?? executionPath === 'stream',
    job: overrides.job ?? executionPath === 'job',
    ...((overrides.artifactKind ?? routeDecision.artifactKind)
      ? { artifactKind: overrides.artifactKind ?? routeDecision.artifactKind }
      : {}),
    reasonCodes: [...routeDecision.reasonCodes],
    ...(escalationReasonCodes.length > 0 && { escalationReasonCodes }),
    ...(plannerShadow && { plannerShadow }),
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
  const executionMode = fromSet(value.executionMode, EXECUTION_MODES);
  const escalationReasonCodes = normalizeCodesFromSet(
    value.escalationReasonCodes,
    ESCALATION_REASON_CODES
  );
  const plannerShadow = normalizePlannerShadow(value.plannerShadow);
  const dataSlot = nonEmptyString(value.dataSlot);
  const traceId = nonEmptyString(value.traceId);

  return {
    kind,
    planVersion,
    routeDecision,
    executionPath,
    ...(executionMode && { executionMode }),
    stream: value.stream,
    job: value.job,
    ...(artifactKind && { artifactKind }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    ...(escalationReasonCodes.length > 0 && { escalationReasonCodes }),
    ...(plannerShadow && { plannerShadow }),
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
