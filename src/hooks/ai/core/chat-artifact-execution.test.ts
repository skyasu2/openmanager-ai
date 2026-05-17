import type { UIMessage } from '@ai-sdk/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeChatArtifact } from '@/lib/ai/chat-artifacts/artifact-execution';
import { registerArtifactExecutor } from '@/lib/ai/chat-artifacts/artifact-executor-registry';
import { ARTIFACT_INTENT_RULE_VERSION } from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import { generateServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/server-snapshot-artifact';
import type { ServerSnapshotArtifact } from '@/lib/ai/chat-artifacts/types';
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
const mockGenerateServerSnapshotArtifact = vi.mocked(
  generateServerSnapshotArtifact
);

const cleanupCallbacks: Array<() => void> = [];

describe('startChatArtifactGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const cleanup of cleanupCallbacks.splice(0)) {
      cleanup();
    }
    vi.useRealTimers();
  });

  it('executes artifact intents through the registered executor', async () => {
    const artifact: ServerSnapshotArtifact = {
      kind: 'server-snapshot',
      generatedAt: '2026-05-17T00:00:00.000Z',
      title: '현재 서버 상태 스냅샷',
      summary: '4대 서버 중 위험 1대입니다.',
      source: 'otel-static',
      slot: {
        slotIndex: 42,
        minuteOfDay: 420,
        timeLabel: '07:00 KST',
      },
      totals: {
        total: 4,
        online: 2,
        warning: 1,
        critical: 1,
        offline: 0,
      },
      averages: {
        cpu: 60,
        memory: 67.8,
        disk: 56.8,
        network: 35,
      },
      topServers: [],
      alerts: [],
    };
    const registeredExecutor = vi.fn(async ({ artifactIntent, query }) => {
      expect(artifactIntent).toMatchObject({
        kind: 'server-snapshot',
        reason: 'server_snapshot_action_pattern',
      });
      expect(query).toBe('현재 서버 상태 스냅샷');
      return artifact;
    });
    cleanupCallbacks.push(
      registerArtifactExecutor({ kind: 'server-snapshot' }, registeredExecutor)
    );

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
        kind: 'server-snapshot',
        reason: 'server_snapshot_action_pattern',
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
      },
      query: '현재 서버 상태 스냅샷',
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

    expect(registeredExecutor).toHaveBeenCalledTimes(1);
    expect(mockGenerateServerSnapshotArtifact).not.toHaveBeenCalled();
    expect(setError).toHaveBeenLastCalledWith(null);
    expect(messages.at(-1)?.metadata).toMatchObject({
      serverSnapshotArtifact: artifact,
    });
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

  it('updates the pending assistant message with delayed artifact progress steps', async () => {
    vi.useFakeTimers();
    mockExecuteChatArtifact.mockReturnValue(new Promise(() => undefined));

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
        kind: 'monitoring-analysis',
        reason: 'monitoring_action_pattern',
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
      },
      query: '전체 서버 이상감지 돌려줘',
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

    expect(messages.at(-1)?.parts).toEqual([
      {
        type: 'text',
        text: '이상감지/추세 분석을 실행하고 있습니다.',
      },
    ]);

    await vi.advanceTimersByTimeAsync(3000);

    expect(messages.at(-1)?.parts).toEqual([
      {
        type: 'text',
        text: '데이터를 수집하고 있습니다...',
      },
    ]);
  });
});
