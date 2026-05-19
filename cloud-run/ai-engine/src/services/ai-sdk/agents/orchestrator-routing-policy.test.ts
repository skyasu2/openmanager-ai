import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  advisorTools,
  mockFilterToolsByRAG,
  mockFilterToolsByWebSearch,
  mockGetAgentConfig,
  mockGetAgentEvidenceBudget,
  mockGetAgentProviderOrder,
} = vi.hoisted(() => {
  const tools = {
    searchKnowledgeBase: { execute: vi.fn() },
    recommendCommands: { execute: vi.fn() },
    finalAnswer: { execute: vi.fn() },
  };

  return {
    advisorTools: tools,
    mockFilterToolsByRAG: vi.fn(),
    mockFilterToolsByWebSearch: vi.fn(),
    mockGetAgentConfig: vi.fn(),
    mockGetAgentEvidenceBudget: vi.fn(),
    mockGetAgentProviderOrder: vi.fn(),
  };
});

vi.mock('./config', () => ({
  getAgentConfig: mockGetAgentConfig,
  getAgentEvidenceBudget: mockGetAgentEvidenceBudget,
  getAgentProviderOrder: mockGetAgentProviderOrder,
}));

vi.mock('./orchestrator-web-search', () => ({
  filterToolsByRAG: mockFilterToolsByRAG,
  filterToolsByWebSearch: mockFilterToolsByWebSearch,
}));

import { resolveForcedRoutingPolicy } from './orchestrator-routing-policy';

describe('orchestrator-routing-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgentConfig.mockImplementation((name: string) =>
      name === 'Advisor Agent'
        ? {
            name: 'Advisor Agent',
            instructions: 'Advisor instructions',
            tools: advisorTools,
          }
        : undefined
    );
    mockGetAgentEvidenceBudget.mockReturnValue(5);
    mockGetAgentProviderOrder.mockReturnValue([
      'mistral',
      'zai',
      'groq',
      'cerebras',
    ]);
  });

  it('resolves forced routing filters, provider order, evidence budget, and forced KB policy together', () => {
    const webFilteredTools = {
      searchKnowledgeBase: advisorTools.searchKnowledgeBase,
      finalAnswer: advisorTools.finalAnswer,
    };
    const ragFilteredTools = {
      searchKnowledgeBase: advisorTools.searchKnowledgeBase,
      finalAnswer: advisorTools.finalAnswer,
    };
    mockFilterToolsByWebSearch.mockReturnValue(webFilteredTools);
    mockFilterToolsByRAG.mockReturnValue(ragFilteredTools);

    const policy = resolveForcedRoutingPolicy({
      query: '인프라 토폴로지 문서 경로 알려줘',
      suggestedAgentName: 'Advisor Agent',
      webSearchEnabled: false,
      ragEnabled: true,
    });

    expect(policy).toMatchObject({
      agentConfig: {
        name: 'Advisor Agent',
        instructions: 'Advisor instructions',
      },
      evidenceBudget: 5,
      forceKnowledgeBaseTool: true,
      isForceKnowledgeBaseQuery: true,
      providerOrder: ['mistral', 'zai', 'groq', 'cerebras'],
    });
    expect(policy?.filteredTools).toBe(ragFilteredTools);
    expect(mockFilterToolsByWebSearch).toHaveBeenCalledWith(
      advisorTools,
      false
    );
    expect(mockFilterToolsByRAG).toHaveBeenCalledWith(webFilteredTools, true);
  });

  it('returns null when the suggested agent has no config', () => {
    mockGetAgentConfig.mockReturnValueOnce(undefined);

    expect(
      resolveForcedRoutingPolicy({
        query: '상태 확인',
        suggestedAgentName: 'Missing Agent',
        webSearchEnabled: true,
        ragEnabled: true,
      })
    ).toBeNull();
  });
});
