import {
  createAssistantRuntime,
  type AssistantDomain,
  type AssistantRequest,
  type AssistantRuntime,
  type AssistantRuntimeAdapters,
  type AssistantRuntimeResult,
} from '../../core/assistant-runtime';
import type { SupervisorRequest } from './supervisor-types';

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
}

export interface AssistantRuntimeHostConfig {
  domain: AssistantDomain;
  adapters: AssistantRuntimeAdapters;
  adapterKinds?: AssistantRuntimeAdapterKinds;
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
