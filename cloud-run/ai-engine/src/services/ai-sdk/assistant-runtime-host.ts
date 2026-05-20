import {
  createAssistantRuntime,
  type AssistantDomain,
  type AssistantRequest,
  type AssistantRequestContext,
  type AssistantRuntime,
  type AssistantRuntimeAdapters,
  type AssistantRuntimeResult,
  type DomainIntentFrame,
  type ToolDefinition,
} from '../../core/assistant-runtime';
import type {
  generateText as aiGenerateText,
  ModelMessage,
  PrepareStepFunction,
  streamText as aiStreamText,
  ToolSet,
} from 'ai';
import type { SupervisorRequest } from './supervisor-types';

type AiSdkStreamTextParams = Parameters<typeof aiStreamText>[0];
type AiSdkGenerateTextParams = Parameters<typeof aiGenerateText>[0];

export type AiSdkStreamExecutionParams = Omit<
  AiSdkStreamTextParams,
  'model'
> & {
  model: unknown;
  messages: ModelMessage[];
};

export type AiSdkStreamExecutionResult = ReturnType<typeof aiStreamText>;

export type AiSdkGenerateExecutionParams = Omit<
  AiSdkGenerateTextParams,
  'model'
> & {
  model: unknown;
  messages: ModelMessage[];
};

export type AiSdkGenerateExecutionResult = ReturnType<typeof aiGenerateText>;

export interface AssistantRuntimeAdapterKinds {
  stateStore: string;
  sessionStore: string;
  jobQueue: string;
  artifactStore?: string;
  vectorStore?: string;
}

export interface AssistantRuntimeMetadata {
  domainId: string;
  domainVersion: string;
  routeKind: AssistantRuntimeResult['route']['kind'];
  executionPath: AssistantRuntimeResult['route']['executionPath'];
  executionMode?: AssistantRuntimeResult['route']['executionMode'];
  reasonCodes: string[];
  adapterKinds: AssistantRuntimeAdapterKinds;
}

export interface AssistantRuntimeHost {
  readonly domain: AssistantDomain;
  readonly adapters: AssistantRuntimeAdapters;
  readonly adapterKinds: AssistantRuntimeAdapterKinds;
  readonly runtime: AssistantRuntime;
  handle(request: AssistantRequest): Promise<AssistantRuntimeResult>;
  createToolSet(input: AssistantRequest | AssistantRequestContext): ToolSet;
  createSystemPrompt(options?: AssistantRuntimePromptOptions): string;
  createPrepareStep(
    query: string,
    options?: AssistantRuntimePrepareStepOptions
  ): AssistantRuntimePrepareStep | undefined;
  executeLLMStream?(
    params: AiSdkStreamExecutionParams
  ): AiSdkStreamExecutionResult;
  executeLLMGenerate?(
    params: AiSdkGenerateExecutionParams
  ): AiSdkGenerateExecutionResult;
}

export interface AssistantRuntimePromptOptions {
  deviceType?: SupervisorRequest['deviceType'];
}

export interface AssistantRuntimePrepareStepOptions {
  enableWebSearch?: boolean;
  enableRAG?: boolean;
  intentFrame?: DomainIntentFrame;
}

export type AssistantRuntimePrepareStep = PrepareStepFunction<ToolSet>;

export interface AssistantRuntimeExecutionAdapter {
  createToolSet?(input: AssistantRequest | AssistantRequestContext): ToolSet;
  createSystemPrompt?(options?: AssistantRuntimePromptOptions): string;
  createPrepareStep?(
    query: string,
    options?: AssistantRuntimePrepareStepOptions
  ): AssistantRuntimePrepareStep | undefined;
  executeLLMStream?(
    params: AiSdkStreamExecutionParams
  ): AiSdkStreamExecutionResult;
  executeLLMGenerate?(
    params: AiSdkGenerateExecutionParams
  ): AiSdkGenerateExecutionResult;
}

export interface AssistantRuntimeHostConfig {
  domain: AssistantDomain;
  adapters: AssistantRuntimeAdapters;
  adapterKinds?: AssistantRuntimeAdapterKinds;
  executionAdapter?: AssistantRuntimeExecutionAdapter;
}

export interface SupervisorRuntimeContext {
  host: AssistantRuntimeHost;
  request: AssistantRequest;
  result: AssistantRuntimeResult;
  metadata: AssistantRuntimeMetadata;
}

function getLastUserMessage(
  request: Pick<SupervisorRequest, 'messages'>
): string {
  return (
    request.messages
      .filter((message) => message.role === 'user')
      .pop()
      ?.content.trim() ?? ''
  );
}

function createRequestId(request: SupervisorRequest, domainId: string): string {
  if (request.traceId) return request.traceId;
  const sessionId = request.sessionId.trim() || 'default';
  return `${domainId}:${sessionId}:${request.messages.length}`;
}

function toAssistantRequest(
  request: SupervisorRequest,
  domain: AssistantDomain
): AssistantRequest {
  return {
    id: createRequestId(request, domain.id),
    domainId: domain.id,
    message: getLastUserMessage(request),
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    sessionId: request.sessionId,
    ...(request.traceId && { traceId: request.traceId }),
    metadata: {
      ...(request.analysisMode && { analysisMode: request.analysisMode }),
      ...(request.enableWebSearch !== undefined && {
        enableWebSearch: request.enableWebSearch,
      }),
      ...(typeof request.enableRAG === 'boolean' && {
        enableRAG: request.enableRAG,
      }),
      ...(request.queryAsOf && { queryAsOf: request.queryAsOf }),
      ...(request.localRouteDecision && {
        localRouteDecision: request.localRouteDecision,
      }),
    },
  };
}

function createRuntimeMetadata(
  host: AssistantRuntimeHost,
  result: AssistantRuntimeResult
): AssistantRuntimeMetadata {
  return {
    domainId: host.domain.id,
    domainVersion: host.domain.version,
    routeKind: result.route.kind,
    executionPath: result.route.executionPath,
    ...(result.route.executionMode && {
      executionMode: result.route.executionMode,
    }),
    reasonCodes: [...result.route.reasonCodes],
    adapterKinds: { ...host.adapterKinds },
  };
}

function isAssistantRequestContext(
  input: AssistantRequest | AssistantRequestContext
): input is AssistantRequestContext {
  return 'requestId' in input;
}

function toAssistantRequestContext(
  domain: AssistantDomain,
  input: AssistantRequest | AssistantRequestContext
): AssistantRequestContext {
  if (isAssistantRequestContext(input)) return input;

  return {
    requestId: input.id,
    domainId: input.domainId ?? domain.id,
    message: input.message,
    messages: input.messages,
    ...(input.sessionId && { sessionId: input.sessionId }),
    ...(input.traceId && { traceId: input.traceId }),
    ...(input.metadata && { metadata: input.metadata }),
  };
}

function createDefaultInputSchema() {
  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
}

function toAiSdkTool(
  tool: ToolDefinition,
  context: AssistantRequestContext
): ToolSet[string] {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema ?? createDefaultInputSchema(),
    ...(tool.execute && {
      execute: (input: unknown) => tool.execute?.(input, context),
    }),
  } as ToolSet[string];
}

function createDomainToolSet(
  runtime: AssistantRuntime,
  domain: AssistantDomain,
  input: AssistantRequest | AssistantRequestContext
): ToolSet {
  const context = toAssistantRequestContext(domain, input);
  return Object.fromEntries(
    runtime.listTools(context).map((tool) => [
      tool.name,
      toAiSdkTool(tool, context),
    ])
  ) as ToolSet;
}

export function createAssistantRuntimeHost(
  config: AssistantRuntimeHostConfig
): AssistantRuntimeHost {
  const runtime = createAssistantRuntime({
    domain: config.domain,
    adapters: config.adapters,
  });

  return {
    domain: config.domain,
    adapters: config.adapters,
    adapterKinds: config.adapterKinds ?? {
      stateStore: 'custom',
      sessionStore: 'custom',
      jobQueue: 'custom',
    },
    runtime,
    handle(request: AssistantRequest) {
      return runtime.handle(request);
    },
    createToolSet(input: AssistantRequest | AssistantRequestContext) {
      return (
        config.executionAdapter?.createToolSet?.(input) ??
        createDomainToolSet(runtime, config.domain, input)
      );
    },
    createSystemPrompt(options?: AssistantRuntimePromptOptions) {
      return (
        config.executionAdapter?.createSystemPrompt?.(options) ??
        config.domain.instructions.system
      );
    },
    createPrepareStep(
      query: string,
      options?: AssistantRuntimePrepareStepOptions
    ) {
      return config.executionAdapter?.createPrepareStep?.(query, options);
    },
    ...(config.executionAdapter?.executeLLMStream && {
      executeLLMStream(params: AiSdkStreamExecutionParams) {
        return config.executionAdapter!.executeLLMStream!(params);
      },
    }),
    ...(config.executionAdapter?.executeLLMGenerate && {
      executeLLMGenerate(params: AiSdkGenerateExecutionParams) {
        return config.executionAdapter!.executeLLMGenerate!(params);
      },
    }),
  };
}

export async function resolveSupervisorRuntimeContext(
  request: SupervisorRequest,
  defaultHost: AssistantRuntimeHost
): Promise<SupervisorRuntimeContext> {
  const host = request.runtimeHost ?? defaultHost;
  const assistantRequest = toAssistantRequest(request, host.domain);
  const result = await host.handle(assistantRequest);

  return {
    host,
    request: assistantRequest,
    result,
    metadata: createRuntimeMetadata(host, result),
  };
}
