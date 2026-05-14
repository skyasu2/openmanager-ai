import type { UIMessage } from '@ai-sdk/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeChatArtifact } from '@/lib/ai/chat-artifacts/artifact-execution';
import { ARTIFACT_INTENT_RULE_VERSION } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { startChatArtifactGeneration } from './chat-artifact-execution';

vi.mock('@/lib/ai/chat-artifacts/artifact-execution', () => ({
  executeChatArtifact: vi.fn(),
}));

vi.mock('@/lib/ai/chat-artifacts/ops-procedure-artifact', () => ({
  generateOpsProcedureArtifact: vi.fn(),
  patchOpsProcedureArtifactFromQuery: vi.fn(),
}));

vi.mock('@/lib/ai/chat-artifacts/server-snapshot-artifact', () => ({
  generateServerSnapshotArtifact: vi.fn(),
}));

const mockExecuteChatArtifact = vi.mocked(executeChatArtifact);

describe('startChatArtifactGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes server-monitoring-analysis intents with the parsed server id', async () => {
    const artifact = {
      kind: 'server-monitoring-analysis',
      generatedAt: '2026-05-14T00:00:00.000Z',
      title: 'api-was-dc1-01 이상감지/추세 분석',
      summary: 'api-was-dc1-01 상태 정상',
      serverId: 'api-was-dc1-01',
      serverName: 'api-was-dc1-01',
      overallStatus: 'online',
      analysis: {
        success: true,
        serverId: 'api-was-dc1-01',
        analysisType: 'full',
        timestamp: '2026-05-14T00:00:00.000Z',
      },
      server: {
        success: true,
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
        analysisType: 'full',
        timestamp: '2026-05-14T00:00:00.000Z',
        overallStatus: 'online',
      },
    } as const;
    mockExecuteChatArtifact.mockResolvedValue(artifact);

    let messages: UIMessage[] = [];
    const messagesRef = { current: messages };
    const setMessages = vi.fn((nextMessages: UIMessage[]) => {
      messages = nextMessages;
      messagesRef.current = nextMessages;
    });
    const setError = vi.fn();
    const setArtifactIsLoading = vi.fn();
    const artifactRequestIdRef = { current: null };
    const artifactAbortControllerRef = { current: null };
    const artifactInFlightRef = { current: false };

    startChatArtifactGeneration({
      artifactIntent: {
        kind: 'server-monitoring-analysis',
        serverId: 'api-was-dc1-01',
        reason: 'server_monitoring_action_pattern',
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
      },
      query: 'api-was-dc1-01 이상감지 분석해줘',
      sessionId: 'session-test',
      messages,
      messagesRef,
      setMessages,
      setError,
      setArtifactIsLoading,
      artifactRequestIdRef,
      artifactAbortControllerRef,
      artifactInFlightRef,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockExecuteChatArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'server-monitoring-analysis',
        query: 'api-was-dc1-01 이상감지 분석해줘',
        sessionId: 'session-test',
        serverId: 'api-was-dc1-01',
        serverName: 'api-was-dc1-01',
      })
    );
    expect(setError).toHaveBeenLastCalledWith(null);
    expect(messages.at(-1)?.metadata).toMatchObject({
      serverMonitoringAnalysisArtifact: artifact,
    });
  });
});
