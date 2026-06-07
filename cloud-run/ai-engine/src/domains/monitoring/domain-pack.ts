import type {
  ArtifactRegistry,
  AssistantArtifact,
  AssistantDomain,
  AssistantRequestContext,
  AssistantRouteCandidate,
  DomainCapabilityManifest,
  DomainDataSource,
  DomainFactPack,
  DomainInstructionSet,
  DomainIntentParser,
  FactPackBuilder,
  ToolDefinition,
  ToolRegistry,
} from '../../core/assistant-runtime';
import {
  getCurrentState,
  getKSTDateTime,
  getRecentHistory,
} from '../../data/precomputed-state';
import { createMonitoringDataSource } from '../../services/monitoring/monitoring-data-source';
import { MONITORING_FACT_PACK_VERSION } from '../../services/monitoring/monitoring-fact-pack';
import type { AgentToolName } from '../../services/ai-sdk/agents/config/agent-runtime-policy';
import {
  detectMonitoringArtifactKind,
  MONITORING_ARTIFACT_KINDS,
  type MonitoringArtifactKind,
} from './artifact-registry';
import { createMonitoringSystemPrompt } from './supervisor-prompt';
import { MONITORING_AGENT_TOOL_REGISTRY } from './tool-registry';
import { selectExecutionMode } from './routing-policy';
import {
  normalizeSupervisorInputType,
  normalizeSupervisorIntentFrame,
} from '../../services/ai-sdk/supervisor-semantic-metadata';
import { monitoringAgentRoleRegistry } from './agent-roles';
import {
  monitoringBoundaryGuardEvidenceProvider,
  monitoringMetricCurrentEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  monitoringMetricTrendEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import {
  monitoringCapacityForecastEvidenceProvider,
  monitoringLocationLoadBalanceEvidenceProvider,
} from './load-balance-capacity-evidence-provider';
import { monitoringPeakMetricEvidenceProvider } from './peak-metric-evidence-provider';
import { classifyEvidenceIntentWithLLM } from './current-metrics-evidence-llm-classifier';
import { parseMonitoringPeakMetricIntent } from './peak-metric-intent';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_DOMAIN_VERSION,
  MONITORING_ANOMALY_DETECTION_CAPABILITY_ID,
  MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID,
  MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
  MONITORING_FAILURE_RISK_CAPABILITY_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
  MONITORING_LOCATION_LOAD_BALANCE_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
export {
  MONITORING_DOMAIN_ID,
  MONITORING_DOMAIN_VERSION,
  MONITORING_ANOMALY_DETECTION_CAPABILITY_ID,
  MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID,
  MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
  MONITORING_FAILURE_RISK_CAPABILITY_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
  MONITORING_LOCATION_LOAD_BALANCE_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';

type RuntimeTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
  execute?: ToolDefinition['execute'];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isMonitoringArtifactKind(value: unknown): value is MonitoringArtifactKind {
  return (
    typeof value === 'string' &&
    MONITORING_ARTIFACT_KINDS.includes(value as MonitoringArtifactKind)
  );
}

function toExecutionMode(
  mode: ReturnType<typeof selectExecutionMode>
): AssistantRouteCandidate['executionMode'] {
  return mode === 'multi' ? 'multi-agent' : 'single-agent';
}

function createRouteCandidate(
  context: AssistantRequestContext
): AssistantRouteCandidate {
  const artifactKind = detectMonitoringArtifactKind(context.message);
  if (artifactKind) {
    return {
      kind: 'artifact',
      executionPath: 'client-artifact',
      executionMode: 'deterministic',
      domainId: MONITORING_DOMAIN_ID,
      reasonCodes: ['monitoring_artifact_requested'],
      metadata: { artifactKind },
    };
  }

  const mode = selectExecutionMode(
    context.message,
    normalizeSupervisorIntentFrame(context.metadata?.intentFrame),
    normalizeSupervisorInputType(context.metadata?.inputType)
  );
  return {
    kind: 'chat',
    executionPath: 'stream',
    executionMode: toExecutionMode(mode),
    domainId: MONITORING_DOMAIN_ID,
    reasonCodes: [`monitoring_${mode}_route`],
  };
}

export function createMonitoringDomainInstructions(
  deviceType?: string
): DomainInstructionSet {
  return {
    system: createMonitoringSystemPrompt(deviceType),
    locale: 'ko-KR',
  };
}

function toToolDefinition(name: AgentToolName): ToolDefinition {
  const runtimeTool = MONITORING_AGENT_TOOL_REGISTRY[name] as RuntimeTool;
  const execute = runtimeTool.execute;
  return {
    name: runtimeTool.name,
    description: runtimeTool.description ?? name,
    ...(runtimeTool.inputSchema === undefined
      ? {}
      : { inputSchema: runtimeTool.inputSchema }),
    ...(execute === undefined
      ? {}
      : { execute }),
  };
}

export const monitoringToolRegistry: ToolRegistry = {
  listTools() {
    return (Object.keys(MONITORING_AGENT_TOOL_REGISTRY) as AgentToolName[]).map(
      toToolDefinition
    );
  },
  resolveTool(name: string) {
    if (!(name in MONITORING_AGENT_TOOL_REGISTRY)) {
      return undefined;
    }

    return toToolDefinition(name as AgentToolName);
  },
};

export const monitoringArtifactRegistry: ArtifactRegistry = {
  classify(input: AssistantRequestContext) {
    const kind = detectMonitoringArtifactKind(input.message);
    return kind
      ? {
          kind,
          version: MONITORING_DOMAIN_VERSION,
        }
      : undefined;
  },
  normalize(value: unknown): AssistantArtifact | undefined {
    if (!isRecord(value) || !isMonitoringArtifactKind(value.kind)) {
      return undefined;
    }

    return {
      kind: value.kind,
      version:
        readString(value.artifactVersion) ??
        readString(value.version) ??
        MONITORING_DOMAIN_VERSION,
      payload: value,
    };
  },
};

export const monitoringFactPackBuilder: FactPackBuilder = {
  async build(input): Promise<DomainFactPack> {
    const snapshot = await createMonitoringDataSource({
      mode: 'replay-json',
    }).getSnapshot({});

    return {
      domainId: input.context.domainId,
      version:
        snapshot.factPack?.factPackVersion ?? MONITORING_FACT_PACK_VERSION,
      facts: {
        factPack: snapshot.factPack,
        snapshot: {
          sourceMode: snapshot.sourceMode,
          queryAsOf: snapshot.queryAsOf,
          slot: snapshot.slot,
          topology: snapshot.topology,
          dataFreshness: snapshot.dataFreshness,
        },
      },
    };
  },
};

export const monitoringDomainDataSource: DomainDataSource = {
  async snapshot() {
    const state = getCurrentState();
    const { date, time } = getKSTDateTime();
    return {
      timestamp: `${date}T${time}:00+09:00`,
      data: state,
    };
  },
  async history(count) {
    return getRecentHistory(count).map((slot) => ({
      timestamp: slot.fullTimestamp,
      slotIndex: slot.slotIndex,
      data: slot,
    }));
  },
};

export const monitoringCapabilities: DomainCapabilityManifest = {
  domainId: MONITORING_DOMAIN_ID,
  version: MONITORING_DOMAIN_VERSION,
  capabilities: [
    {
      id: MONITORING_PEAK_METRIC_CAPABILITY_ID,
      description:
        'Resolve peak metric time windows and top affected monitoring entities.',
      intents: ['metric_peak'],
      requiredSlots: ['metric', 'timeWindow', 'aggregation'],
      optionalSlots: ['topN', 'targets', 'scope'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      description:
        'Resolve current metric summaries for whole-fleet, entity, or server group scopes directly from monitoring snapshots.',
      intents: ['metric_current'],
      requiredSlots: ['metric'],
      optionalSlots: ['targets', 'scope'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      description:
        'Resolve current metric Top-N rankings directly from monitoring snapshots.',
      intents: ['metric_ranking', 'metric_current'],
      requiredSlots: ['metric', 'aggregation'],
      optionalSlots: ['topN', 'rankOrder', 'scope'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_METRIC_TREND_CAPABILITY_ID,
      description:
        'Resolve current-vs-24h metric trend summaries directly from monitoring snapshots.',
      intents: ['metric_trend'],
      requiredSlots: ['metric'],
      optionalSlots: ['targets', 'scope', 'timeWindow'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      description:
        'Resolve current whole-fleet server health summaries directly from monitoring snapshots.',
      intents: ['server_health'],
      requiredSlots: ['aggregation'],
      optionalSlots: ['targets', 'scope'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_ANOMALY_DETECTION_CAPABILITY_ID,
      description:
        'Route current anomaly detection requests to the Analyst evidence path.',
      intents: ['anomaly_detection'],
      requiredSlots: ['scope'],
      optionalSlots: ['metric', 'targets', 'timeWindow'],
    },
    {
      id: MONITORING_ANOMALY_PREDICTION_CAPABILITY_ID,
      description:
        'Route future anomaly signal requests to the Analyst evidence path.',
      intents: ['anomaly_prediction'],
      requiredSlots: ['scope'],
      optionalSlots: ['metric', 'targets', 'timeWindow'],
    },
    {
      id: MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
      description:
        'Route capacity saturation forecast requests to the Analyst evidence path.',
      intents: ['capacity_forecast'],
      requiredSlots: ['metric'],
      optionalSlots: ['targets', 'scope', 'timeWindow'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_LOCATION_LOAD_BALANCE_CAPABILITY_ID,
      description:
        'Resolve availability-zone load balance summaries directly from monitoring snapshots.',
      intents: ['location_load_balance'],
      requiredSlots: ['scope'],
      optionalSlots: ['metric', 'targets'],
      metadata: { evidenceRequired: true },
    },
    {
      id: MONITORING_FAILURE_RISK_CAPABILITY_ID,
      description:
        'Route broad failure-risk screening requests to the Analyst evidence path.',
      intents: ['failure_risk'],
      requiredSlots: ['scope'],
      optionalSlots: ['metric', 'targets', 'timeWindow'],
    },
  ],
};

export const monitoringIntentParser: DomainIntentParser = {
  async parse(context) {
    const peakFrame = parseMonitoringPeakMetricIntent(context);
    if (peakFrame) return peakFrame;

    // regex 파싱 우선, 미매칭 시 LLM semantic fallback (2s timeout, round-robin provider)
    const currentMetricsFrame =
      parseCurrentMetricsEvidenceRequest(context) ??
      (await classifyEvidenceIntentWithLLM(context.message));
    if (!currentMetricsFrame) return undefined;

    return {
      domainId: MONITORING_DOMAIN_ID,
      intent: currentMetricsFrame.intent,
      capabilityId: currentMetricsFrame.capabilityId,
      scope:
        currentMetricsFrame.targets && currentMetricsFrame.targets.length > 0
          ? 'entity'
          : 'whole_fleet',
      targets: currentMetricsFrame.targets ?? [],
      ...(currentMetricsFrame.metric && { metric: currentMetricsFrame.metric }),
      timeWindow: 'current',
      aggregation:
        currentMetricsFrame.intent === 'metric_ranking' ? 'top_n' : 'summary',
      ...(currentMetricsFrame.rankCount && {
        topN: currentMetricsFrame.rankCount,
      }),
      slots: { sourceIntent: currentMetricsFrame.sourceIntent },
      ambiguity: currentMetricsFrame.sourceIntent === 'llm-classified' ? 'medium' : 'low',
      confidence: currentMetricsFrame.sourceIntent === 'llm-classified' ? 0.75 : 0.9,
    };
  },
};

const monitoringRoutingOverridePolicy: AssistantDomain['routingOverridePolicy'] = {
  defaultDirectRoutingAgent: 'Metrics Query Agent',
  semanticConfidenceThreshold: 0.65,
  analystOverrideCapabilities: [
    MONITORING_METRIC_CURRENT_CAPABILITY_ID,
    MONITORING_SERVER_HEALTH_CAPABILITY_ID,
  ],
  analystOverrideIntents: ['metric_current', 'server_health'],
};

export const monitoringDomainPack: AssistantDomain = {
  id: MONITORING_DOMAIN_ID,
  version: MONITORING_DOMAIN_VERSION,
  instructions: createMonitoringDomainInstructions(),
  routingPolicy: {
    decide: createRouteCandidate,
  },
  tools: monitoringToolRegistry,
  artifacts: monitoringArtifactRegistry,
  facts: monitoringFactPackBuilder,
  agentRoles: monitoringAgentRoleRegistry,
  dataSource: monitoringDomainDataSource,
  capabilities: monitoringCapabilities,
  intentParser: monitoringIntentParser,
  routingOverridePolicy: monitoringRoutingOverridePolicy,
  evidenceProviders: [
    monitoringBoundaryGuardEvidenceProvider,
    monitoringPeakMetricEvidenceProvider,
    monitoringLocationLoadBalanceEvidenceProvider,
    monitoringCapacityForecastEvidenceProvider,
    monitoringMetricCurrentEvidenceProvider,
    monitoringMetricRankingEvidenceProvider,
    monitoringMetricTrendEvidenceProvider,
    monitoringServerHealthEvidenceProvider,
  ],
};
