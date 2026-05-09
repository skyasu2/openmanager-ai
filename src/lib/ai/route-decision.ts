import {
  MONITORING_ROUTE_DECISION_ARTIFACT_KINDS,
  type MonitoringRouteDecisionArtifactKind,
} from './domains/monitoring/artifact-registry';

export const ROUTE_DECISION_RULE_VERSION = '2026-05-03-v1';

export type RouteDecisionIntent = 'chat' | 'artifact' | 'job' | 'clarification';

export type RouteDecisionExecutionPath = 'stream' | 'job' | 'client-artifact';

export type RouteDecisionMode = 'single' | 'multi';

export type RouteDecisionArtifactKind = MonitoringRouteDecisionArtifactKind;

export type RouteDecisionComplexity =
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'very_complex';

export type RouteDecisionDecider = 'frontend' | 'bff' | 'cloud-run';

export interface RouteDecision {
  intent: RouteDecisionIntent;
  executionPath: RouteDecisionExecutionPath;
  mode?: RouteDecisionMode;
  artifactKind?: RouteDecisionArtifactKind;
  complexity?: RouteDecisionComplexity;
  reasonCodes: string[];
  ruleVersion: string;
  dataSlot?: string;
  traceId?: string;
  decidedBy: RouteDecisionDecider;
}

export type BuildRouteDecisionInput = Omit<
  RouteDecision,
  'reasonCodes' | 'ruleVersion'
> & {
  reasonCodes?: string[];
  ruleVersion?: string;
};

const INTENTS = new Set<RouteDecisionIntent>([
  'chat',
  'artifact',
  'job',
  'clarification',
]);
const EXECUTION_PATHS = new Set<RouteDecisionExecutionPath>([
  'stream',
  'job',
  'client-artifact',
]);
const MODES = new Set<RouteDecisionMode>(['single', 'multi']);
const ARTIFACT_KINDS = new Set<RouteDecisionArtifactKind>(
  MONITORING_ROUTE_DECISION_ARTIFACT_KINDS
);
const COMPLEXITIES = new Set<RouteDecisionComplexity>([
  'simple',
  'moderate',
  'complex',
  'very_complex',
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

function normalizeReasonCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(nonEmptyString)
    .filter((item): item is string => item !== undefined);
}

function fromSet<T extends string>(
  value: unknown,
  allowed: Set<T>
): T | undefined {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : undefined;
}

export function buildRouteDecision(
  input: BuildRouteDecisionInput
): RouteDecision {
  const reasonCodes = normalizeReasonCodes(input.reasonCodes);

  return {
    intent: input.intent,
    executionPath: input.executionPath,
    ...(input.mode && { mode: input.mode }),
    ...(input.artifactKind && { artifactKind: input.artifactKind }),
    ...(input.complexity && { complexity: input.complexity }),
    reasonCodes,
    ruleVersion: input.ruleVersion ?? ROUTE_DECISION_RULE_VERSION,
    ...(input.dataSlot && { dataSlot: input.dataSlot }),
    ...(input.traceId && { traceId: input.traceId }),
    decidedBy: input.decidedBy,
  };
}

export function normalizeRouteDecision(
  value: unknown
): RouteDecision | undefined {
  if (!isRecord(value)) return undefined;

  const intent = fromSet(value.intent, INTENTS);
  const executionPath = fromSet(value.executionPath, EXECUTION_PATHS);
  const decidedBy = fromSet(value.decidedBy, DECIDERS);
  if (!intent || !executionPath || !decidedBy) return undefined;

  const mode = fromSet(value.mode, MODES);
  const artifactKind = fromSet(value.artifactKind, ARTIFACT_KINDS);
  const complexity = fromSet(value.complexity, COMPLEXITIES);
  const ruleVersion =
    nonEmptyString(value.ruleVersion) ?? ROUTE_DECISION_RULE_VERSION;
  const dataSlot = nonEmptyString(value.dataSlot);
  const traceId = nonEmptyString(value.traceId);

  return buildRouteDecision({
    intent,
    executionPath,
    ...(mode && { mode }),
    ...(artifactKind && { artifactKind }),
    ...(complexity && { complexity }),
    reasonCodes: normalizeReasonCodes(value.reasonCodes),
    ruleVersion,
    ...(dataSlot && { dataSlot }),
    ...(traceId && { traceId }),
    decidedBy,
  });
}
