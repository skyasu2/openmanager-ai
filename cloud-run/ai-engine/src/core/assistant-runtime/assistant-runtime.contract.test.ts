import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createAssistantRuntime,
  createInMemoryAssistantRuntimeAdapters,
  type AssistantDomain,
  type AssistantRequest,
  type AssistantRequestContext,
  type ToolDefinition,
} from './index';

const AI_ENGINE_ROOT = process.cwd();
const REPO_ROOT = join(AI_ENGINE_ROOT, '..', '..');
const CORE_ROOT = join(AI_ENGINE_ROOT, 'src/core');
const PUBLIC_RUNTIME_FACADE = join(
  AI_ENGINE_ROOT,
  'src/core/assistant-runtime/index.ts'
);
const AI_ENGINE_ARCHITECTURE_DOC = join(
  REPO_ROOT,
  'docs/reference/architecture/ai/ai-engine-architecture.md'
);

const DISALLOWED_CORE_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  {
    label: 'monitoring service import',
    pattern: /from ['"][^'"]*services\/monitoring[^'"]*['"]/,
  },
  {
    label: 'monitoring tool import',
    pattern: /from ['"][^'"]*tools-ai-sdk\/[^'"]*monitoring[^'"]*['"]/,
  },
  {
    label: 'precomputed monitoring state import',
    pattern: /from ['"][^'"]*data\/precomputed-state(?:-core)?[^'"]*['"]/,
  },
  {
    label: 'monitoring domain import',
    pattern: /from ['"][^'"]*domains\/monitoring[^'"]*['"]/,
  },
  {
    label: 'monitoring artifact literal',
    pattern: /['"`](server-snapshot|incident-report|monitoring-analysis)['"`]/,
  },
  {
    label: 'monitoring prompt glossary',
    pattern: /\b(CPU|RCA|서버 모니터링|장애 보고서)\b/u,
  },
];

function listCoreSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      return listCoreSourceFiles(path);
    }

    if (
      !entry.endsWith('.ts') ||
      entry.endsWith('.test.ts') ||
      entry.endsWith('.spec.ts')
    ) {
      return [];
    }

    return [path];
  });
}

function createSampleDomain(): AssistantDomain {
  const sampleTool: ToolDefinition = {
    name: 'sampleLookup',
    description: 'Returns deterministic sample data.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    execute: async (input) => ({
      echoed:
        typeof input === 'object' &&
        input !== null &&
        'query' in input &&
        typeof input.query === 'string'
          ? input.query
          : '',
    }),
  };

  return {
    id: 'sample-support',
    version: '2026-05-05-test',
    instructions: {
      system: 'Answer with deterministic sample data.',
    },
    routingPolicy: {
      decide(context: AssistantRequestContext) {
        return {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'single-agent',
          domainId: context.domainId,
          reasonCodes: ['sample-domain-route'],
        };
      },
    },
    tools: {
      listTools() {
        return [sampleTool];
      },
      resolveTool(name: string) {
        return name === sampleTool.name ? sampleTool : undefined;
      },
    },
  };
}

function createSampleRequest(): AssistantRequest {
  return {
    id: 'req-sample-1',
    domainId: 'sample-support',
    message: 'lookup sample',
    messages: [{ role: 'user', content: 'lookup sample' }],
  };
}

describe('assistant runtime scaffold contract', () => {
  it('keeps the public assistant runtime facade domain-neutral', () => {
    const source = readFileSync(PUBLIC_RUNTIME_FACADE, 'utf8');
    const forbiddenPatterns = [
      /domains\/monitoring/,
      /monitoring-runtime-host/,
      /provider-model-policy/,
      /services\/monitoring/,
      /tools-ai-sdk/,
    ];

    expect(source).toContain("from './runtime'");
    expect(source).toContain("from './in-memory-adapters'");
    expect(source).toContain('createAssistantRuntime');
    expect(source).toContain('createInMemoryAssistantRuntimeAdapters');
    expect(source).toContain('AssistantDomain');

    const findings = forbiddenPatterns.flatMap((pattern) => {
      const match = pattern.exec(source);
      if (!match) return [];

      return [`${relative(AI_ENGINE_ROOT, PUBLIC_RUNTIME_FACADE)} must not expose ${pattern}`];
    });

    expect(findings).toEqual([]);
  });

  it('documents portable adoption using the real public facade and sample domain fixture', () => {
    const guide = readFileSync(AI_ENGINE_ARCHITECTURE_DOC, 'utf8');

    expect(guide).toContain('Portable Assistant Runtime Adoption');
    expect(guide).toContain('cloud-run/ai-engine/src/core/assistant-runtime');
    expect(guide).toContain(
      'cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts'
    );
    expect(guide).toContain('createAssistantRuntime');
    expect(guide).toContain('createInMemoryAssistantRuntimeAdapters');
    expect(guide).toContain('AssistantDomain');
    expect(guide).toContain('reasoningCapability');
  });

  it('keeps core source files free of monitoring domain dependencies', () => {
    expect(existsSync(CORE_ROOT)).toBe(true);

    const findings = listCoreSourceFiles(CORE_ROOT).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return DISALLOWED_CORE_PATTERNS.flatMap((rule) => {
        const match = rule.pattern.exec(source);
        if (!match) return [];

        const line = source.slice(0, match.index).split('\n').length;
        return [
          `${relative(AI_ENGINE_ROOT, file)}:${line}: ${rule.label} must stay in a domain pack or adapter`,
        ];
      });
    });

    expect(findings).toEqual([]);
  });

  it('registers and routes a mock domain pack without core code changes', async () => {
    const adapters = createInMemoryAssistantRuntimeAdapters();
    const runtime = createAssistantRuntime({
      domain: createSampleDomain(),
      adapters,
    });
    const request = createSampleRequest();

    const result = await runtime.handle(request);

    expect(result).toMatchObject({
      kind: 'chat',
      status: 'accepted',
      domainId: 'sample-support',
      route: {
        kind: 'chat',
        executionPath: 'stream',
        executionMode: 'single-agent',
        reasonCodes: ['sample-domain-route'],
      },
    });
    expect(runtime.listTools(request).map((tool) => tool.name)).toEqual([
      'sampleLookup',
    ]);
    await expect(
      runtime.resolveTool('sampleLookup', request)?.execute?.(
        { query: 'hello' },
        result.context
      )
    ).resolves.toEqual({ echoed: 'hello' });
  });

  it('keeps agent role registry as an optional portable domain contract', () => {
    const domain = createSampleDomain();
    const roles = domain.agentRoles?.listRoles();

    expect(roles).toEqual([
      {
        id: 'sample-researcher',
        name: 'Sample Researcher',
        description: 'Looks up deterministic sample records.',
        capabilities: ['sample-lookup'],
      },
      {
        id: 'sample-summarizer',
        name: 'Sample Summarizer',
        description: 'Summarizes deterministic sample records.',
        matchPatterns: ['summarize', 'summary'],
        capabilities: ['sample-summary'],
      },
    ]);
    expect(domain.agentRoles?.resolveRole('sample-researcher')).toMatchObject({
      id: 'sample-researcher',
      name: 'Sample Researcher',
    });
    expect(domain.agentRoles?.resolveRole('unknown-role')).toBeUndefined();
  });

  it('provides deterministic in-memory adapters for portability smoke tests', async () => {
    const adapters = createInMemoryAssistantRuntimeAdapters();
    const request = createSampleRequest();

    await adapters.sessionStore.saveMessages('session-1', request.messages);
    expect(await adapters.sessionStore.loadMessages('session-1')).toEqual(
      request.messages
    );

    await adapters.stateStore.set('route:req-sample-1', {
      status: 'accepted',
    });
    expect(await adapters.stateStore.get('route:req-sample-1')).toEqual({
      status: 'accepted',
    });

    const job = await adapters.jobQueue.enqueue({
      requestId: request.id,
      domainId: request.domainId,
      payload: { message: request.message },
    });

    expect(job).toMatchObject({
      id: expect.stringMatching(/^job-/),
      status: 'queued',
      requestId: request.id,
      domainId: request.domainId,
    });
  });
});
