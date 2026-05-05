import type {
  AssistantDomain,
  AssistantRequest,
  AssistantRequestContext,
  AssistantRuntime,
  AssistantRuntimeAdapters,
  AssistantRuntimeConfig,
  AssistantRuntimeResult,
  ToolDefinition,
} from './types';

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function assertFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`${label} is required`);
  }
}

function validateDomain(domain: AssistantDomain | undefined): AssistantDomain {
  if (!domain) {
    throw new Error('Assistant domain is required');
  }

  if (!readNonEmptyString(domain.id)) {
    throw new Error('Assistant domain id is required');
  }

  if (!readNonEmptyString(domain.version)) {
    throw new Error('Assistant domain version is required');
  }

  if (!readNonEmptyString(domain.instructions?.system)) {
    throw new Error('Assistant domain system instructions are required');
  }

  assertFunction(domain.routingPolicy?.decide, 'RoutingPolicy.decide');
  assertFunction(domain.tools?.listTools, 'ToolRegistry.listTools');
  assertFunction(domain.tools?.resolveTool, 'ToolRegistry.resolveTool');

  return domain;
}

function validateAdapters(
  adapters: AssistantRuntimeAdapters | undefined
): AssistantRuntimeAdapters {
  if (!adapters) {
    throw new Error('Assistant runtime adapters are required');
  }

  assertFunction(adapters.stateStore?.get, 'AssistantStateStore.get');
  assertFunction(adapters.stateStore?.set, 'AssistantStateStore.set');
  assertFunction(adapters.jobQueue?.enqueue, 'AssistantJobQueue.enqueue');
  assertFunction(
    adapters.sessionStore?.loadMessages,
    'AssistantSessionStore.loadMessages'
  );
  assertFunction(
    adapters.sessionStore?.saveMessages,
    'AssistantSessionStore.saveMessages'
  );

  return adapters;
}

function isRequestContext(
  input: AssistantRequest | AssistantRequestContext
): input is AssistantRequestContext {
  return 'requestId' in input;
}

function createRequestContext(
  domain: AssistantDomain,
  input: AssistantRequest | AssistantRequestContext
): AssistantRequestContext {
  if (isRequestContext(input)) {
    return input;
  }

  const domainId = input.domainId ?? domain.id;
  if (domainId !== domain.id) {
    throw new Error(
      `Assistant domain mismatch: runtime=${domain.id}, request=${domainId}`
    );
  }

  return {
    requestId: input.id,
    domainId,
    message: input.message,
    messages: input.messages,
    ...(input.sessionId && { sessionId: input.sessionId }),
    ...(input.traceId && { traceId: input.traceId }),
    ...(input.metadata && { metadata: input.metadata }),
  };
}

export function createAssistantRuntime(
  config: AssistantRuntimeConfig
): AssistantRuntime {
  const domain = validateDomain(config.domain);
  const adapters = validateAdapters(config.adapters);

  return {
    domain,
    adapters,
    async handle(request: AssistantRequest): Promise<AssistantRuntimeResult> {
      const context = createRequestContext(domain, request);
      const route = domain.routingPolicy.decide(context);

      return {
        kind: route.kind,
        status: 'accepted',
        domainId: domain.id,
        route,
        context,
      };
    },
    listTools(
      input: AssistantRequest | AssistantRequestContext
    ): ToolDefinition[] {
      return domain.tools.listTools(createRequestContext(domain, input));
    },
    resolveTool(
      name: string,
      input: AssistantRequest | AssistantRequestContext
    ): ToolDefinition | undefined {
      return domain.tools.resolveTool(
        name,
        createRequestContext(domain, input)
      );
    },
  };
}
