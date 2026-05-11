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
  DomainIntentFrame,
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
import { monitoringAgentRoleRegistry } from './agent-roles';
import { monitoringPeakMetricEvidenceProvider } from './peak-metric-evidence-provider';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_DOMAIN_VERSION,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
} from './constants';
export {
  MONITORING_DOMAIN_ID,
  MONITORING_DOMAIN_VERSION,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
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

const PEAK_PATTERN = /가장|최고|최대|피크|높|high|peak|max/i;
const TIME_QUESTION_PATTERN = /언제|시간대|시각|몇\s*시|when|time/i;
const TIME_WINDOW_PATTERN =
  /24\s*시간|\b24\s*h(?:ours?)?\b|하루|최근|지난|last\s*24/i;
const HOURS_PATTERN = /(\d{1,2})\s*(?:시간|h|hr|hour)s?/i;
const METRIC_PATTERNS: Array<{ metric: string; pattern: RegExp }> = [
  { metric: 'load', pattern: /부하|로드|\bload(?:1|5)?\b/i },
  { metric: 'cpu', pattern: /\bcpu\b|씨피유/i },
  { metric: 'memory', pattern: /메모리|\bmem\b|\bmemory\b/i },
  { metric: 'disk', pattern: /디스크|\bdisk\b|스토리지|\bstorage\b/i },
  { metric: 'network', pattern: /네트워크|\bnetwork\b|\bnet\b/i },
];

function parseMonitoringPeakMetricFrame(
  context: AssistantRequestContext
): DomainIntentFrame | undefined {
  const message = context.message;
  const metric =
    METRIC_PATTERNS.find(({ pattern }) => pattern.test(message))?.metric ??
    undefined;

  if (
    !metric ||
    !PEAK_PATTERN.test(message) ||
    !TIME_QUESTION_PATTERN.test(message) ||
    !TIME_WINDOW_PATTERN.test(message)
  ) {
    return undefined;
  }

  const parsedHours = Number(message.match(HOURS_PATTERN)?.[1]);
  const windowHours =
    Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : 24;

  return {
    domainId: MONITORING_DOMAIN_ID,
    intent: 'metric_peak',
    capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
    scope: 'whole_fleet',
    targets: [],
    metric,
    timeWindow: `${windowHours}h`,
    aggregation: 'peak',
    topN: 3,
    ambiguity: 'low',
    confidence: 0.9,
  };
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

  const mode = selectExecutionMode(context.message);
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
    },
  ],
};

export const monitoringIntentParser: DomainIntentParser = {
  parse: parseMonitoringPeakMetricFrame,
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
  evidenceProviders: [monitoringPeakMetricEvidenceProvider],
};
