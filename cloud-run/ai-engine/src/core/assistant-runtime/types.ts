export type AssistantMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AssistantMessage {
  role: AssistantMessageRole;
  content: string;
  name?: string;
}

export interface DomainInstructionSet {
  system: string;
  locale?: string;
}

export interface AssistantRequest {
  id: string;
  domainId?: string;
  message: string;
  messages: AssistantMessage[];
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AssistantRequestContext {
  requestId: string;
  domainId: string;
  message: string;
  messages: AssistantMessage[];
  sessionId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

export type AssistantRouteKind = 'chat' | 'artifact' | 'clarification';

export type AssistantExecutionPath = 'stream' | 'job' | 'client-artifact';

export type AssistantExecutionMode =
  | 'deterministic'
  | 'single-agent'
  | 'multi-agent';

export interface AssistantRouteCandidate {
  kind: AssistantRouteKind;
  executionPath: AssistantExecutionPath;
  executionMode?: AssistantExecutionMode;
  domainId: string;
  reasonCodes: string[];
  metadata?: Record<string, unknown>;
}

export interface RoutingPolicy {
  decide(input: AssistantRequestContext): AssistantRouteCandidate;
}

export type ToolExecuteResult = unknown | Promise<unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema?: unknown;
  execute?: (
    input: unknown,
    context: AssistantRequestContext
  ) => ToolExecuteResult;
}

export interface ToolRegistry {
  listTools(context: AssistantRequestContext): ToolDefinition[];
  resolveTool(
    name: string,
    context: AssistantRequestContext
  ): ToolDefinition | undefined;
}

export interface ArtifactCandidate {
  kind: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface AssistantArtifact {
  kind: string;
  version?: string;
  payload: unknown;
}

export interface ArtifactRegistry {
  classify(input: AssistantRequestContext): ArtifactCandidate | undefined;
  normalize(value: unknown): AssistantArtifact | undefined;
}

export interface DomainFactInput {
  context: AssistantRequestContext;
  source?: unknown;
}

export interface DomainFactPack {
  domainId: string;
  version?: string;
  facts: Record<string, unknown>;
}

export interface FactPackBuilder {
  build(input: DomainFactInput): DomainFactPack | Promise<DomainFactPack>;
}

export interface AgentRole {
  id: string;
  name: string;
  description: string;
  matchPatterns?: (string | RegExp)[];
  capabilities?: string[];
  runtimeConfigKey?: string;
}

export interface AgentRoleRegistry {
  listRoles(): AgentRole[];
  resolveRole(id: string): AgentRole | undefined;
}

export interface DomainSnapshot {
  timestamp: string;
  data: unknown;
}

export interface DomainHistoryEntry {
  timestamp: string;
  slotIndex?: number;
  data: unknown;
}

export interface DomainCapability {
  id: string;
  description: string;
  intents: string[];
  requiredSlots?: string[];
  optionalSlots?: string[];
  metadata?: Record<string, unknown>;
}

export interface DomainCapabilityManifest {
  domainId: string;
  version?: string;
  capabilities: DomainCapability[];
}

export type DomainIntentScope = 'whole_fleet' | 'entity' | 'group' | 'unknown';

export type DomainIntentAmbiguity = 'low' | 'medium' | 'high';

export type DomainIntentExecutionMode = 'single' | 'multi' | 'unknown';

export type AssistantInputType =
  | 'natural_query'
  | 'log_paste'
  | 'mixed'
  | 'oversized';

export interface DomainIntentFrame {
  domainId: string;
  intent: string;
  capabilityId?: string;
  scope: DomainIntentScope;
  targets: string[];
  metric?: string;
  timeWindow?: string;
  aggregation?: string;
  topN?: number;
  ambiguity: DomainIntentAmbiguity;
  executionMode?: DomainIntentExecutionMode;
  confidence: number;
  slots?: Record<string, unknown>;
}

export interface DomainIntentParser {
  parse(
    context: AssistantRequestContext
  ): DomainIntentFrame | undefined | Promise<DomainIntentFrame | undefined>;
}

export interface DomainEvidenceRequest extends AssistantRequestContext {
  dataSource?: DomainDataSource;
  intentFrame?: DomainIntentFrame;
  capability?: DomainCapability;
}

export interface DomainEvidenceResult {
  id: string;
  prompt: string;
  fallback: string;
  metadata?: Record<string, unknown>;
}

export interface DomainEvidenceProvider {
  id: string;
  canHandle(request: DomainEvidenceRequest): boolean;
  resolve(request: DomainEvidenceRequest): Promise<DomainEvidenceResult | null>;
}

export interface DomainDataSource {
  snapshot(context: AssistantRequestContext): Promise<DomainSnapshot>;
  history(
    count: number,
    context: AssistantRequestContext
  ): Promise<DomainHistoryEntry[]>;
}

export interface AssistantDomain {
  id: string;
  version: string;
  instructions: DomainInstructionSet;
  routingPolicy: RoutingPolicy;
  tools: ToolRegistry;
  artifacts?: ArtifactRegistry;
  facts?: FactPackBuilder;
  agentRoles?: AgentRoleRegistry;
  dataSource?: DomainDataSource;
  capabilities?: DomainCapabilityManifest;
  intentParser?: DomainIntentParser;
  evidenceProviders?: DomainEvidenceProvider[];
}

export interface AssistantStateStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface AssistantQueuedJobInput {
  requestId: string;
  domainId: string;
  payload: unknown;
}

export interface AssistantQueuedJob {
  id: string;
  status: 'queued';
  requestId: string;
  domainId: string;
  payload: unknown;
}

export interface AssistantJobQueue {
  enqueue(input: AssistantQueuedJobInput): Promise<AssistantQueuedJob>;
}

export interface AssistantSessionStore {
  loadMessages(sessionId: string): Promise<AssistantMessage[]>;
  saveMessages(
    sessionId: string,
    messages: readonly AssistantMessage[]
  ): Promise<void>;
}

export interface AssistantArtifactStore {
  read<T = unknown>(key: string): Promise<T | undefined>;
  write<T = unknown>(key: string, value: T): Promise<void>;
}

export interface AssistantVectorStore {
  search(query: string, options?: Record<string, unknown>): Promise<unknown[]>;
}

export interface AssistantRuntimeAdapters {
  stateStore: AssistantStateStore;
  jobQueue: AssistantJobQueue;
  sessionStore: AssistantSessionStore;
  artifactStore?: AssistantArtifactStore;
  vectorStore?: AssistantVectorStore;
}

export interface AssistantRuntimeConfig {
  domain: AssistantDomain;
  adapters: AssistantRuntimeAdapters;
}

export type AssistantRuntimeStatus = 'accepted';

export interface AssistantRuntimeResult {
  kind: AssistantRouteKind;
  status: AssistantRuntimeStatus;
  domainId: string;
  route: AssistantRouteCandidate;
  context: AssistantRequestContext;
}

export interface AssistantRuntime {
  readonly domain: AssistantDomain;
  readonly adapters: AssistantRuntimeAdapters;
  handle(request: AssistantRequest): Promise<AssistantRuntimeResult>;
  listTools(
    input: AssistantRequest | AssistantRequestContext
  ): ToolDefinition[];
  resolveTool(
    name: string,
    input: AssistantRequest | AssistantRequestContext
  ): ToolDefinition | undefined;
}
