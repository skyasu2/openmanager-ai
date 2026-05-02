/**
 * @vitest-environment jsdom
 */

import type { UIMessage } from '@ai-sdk/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComponent } from '@/components/ai-sidebar/SidebarMessage';
import { transformMessages } from '@/hooks/ai/utils/message-helpers';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';

vi.mock('@/components/ai/MessageActions', () => ({
  MessageActions: () => null,
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

vi.mock('@/components/ai/AnalysisBasisBadge', () => ({
  AnalysisBasisBadge: ({
    basis,
    details,
    debugDetails,
  }: {
    basis: { dataSource: string; ragUsed?: boolean };
    details?: string | null;
    debugDetails?: string | null;
  }) => (
    <div
      data-testid="analysis-basis-badge"
      data-details={details ?? ''}
      data-debug-details={debugDetails ?? ''}
    >
      <span>{basis.dataSource}</span>
      {basis.ragUsed ? <span>RAG</span> : null}
    </div>
  ),
}));

function createMessage(params: {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}): UIMessage {
  return {
    id: params.id,
    role: params.role,
    parts: [{ type: 'text', text: params.text }],
  } as unknown as UIMessage;
}

describe('SidebarMessage RAG badge smoke integration', () => {
  it('renders RAG badge from stream ragSources propagated via transformMessages', () => {
    const ragSources = [
      {
        title: 'Redis OOM 대응 가이드',
        similarity: 0.93,
        sourceType: 'knowledge-base',
        category: 'incident',
        url: 'https://example.com/redis-oom',
      },
    ];

    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'Redis OOM 원인 분석 부탁',
        }),
        createMessage({
          id: 'a1',
          role: 'assistant',
          text: '유사 사례를 기반으로 분석했습니다.',
        }),
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
        streamRagSources: ragSources,
      }
    );

    const assistantMessage = messages.find((message) => message.id === 'a1');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.metadata?.analysisBasis?.ragSources).toEqual(
      ragSources
    );
    expect(assistantMessage?.metadata?.analysisBasis?.dataSource).toContain(
      'RAG 지식베이스 검색'
    );

    render(
      <MessageComponent message={assistantMessage!} isLastMessage={true} />
    );

    const badge = screen.getByTestId('analysis-basis-badge');
    expect(badge).toHaveTextContent('RAG 지식베이스 검색 (1건)');
    expect(badge).toHaveTextContent('RAG');
    expect(screen.getByText('RAG 사용됨')).toBeInTheDocument();
    expect(screen.queryByText('RAG 허용')).not.toBeInTheDocument();
  });

  it('labels web source usage as used, not merely enabled', () => {
    const assistantMessage: EnhancedChatMessage = {
      id: 'a-web',
      role: 'assistant',
      content: '최신 외부 문서를 참고했습니다.',
      timestamp: new Date('2026-04-25T00:00:00.000Z'),
      metadata: {
        analysisBasis: {
          dataSource: '웹 검색 (1건)',
          engine: 'Streaming AI',
          ragSources: [
            {
              title: 'Kubernetes resource management',
              similarity: 1,
              sourceType: 'web',
              url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
            },
          ],
        },
      },
    };

    render(
      <MessageComponent message={assistantMessage} isLastMessage={true} />
    );

    expect(screen.getByText('Web 사용됨')).toBeInTheDocument();
    expect(screen.queryByText('Web 허용')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '참고 출처 1건' })
    ).toBeInTheDocument();
  });

  it('renders allowed and suppressed feature states without claiming usage', () => {
    const assistantMessage: EnhancedChatMessage = {
      id: 'a-status',
      role: 'assistant',
      content: '현재 답변은 실시간 데이터만으로 충분합니다.',
      timestamp: new Date('2026-04-25T00:00:00.000Z'),
      metadata: {
        analysisBasis: {
          dataSource: '일반 대화 응답 (RAG 활성)',
          engine: 'Streaming AI',
          ragUsed: false,
          analysisMode: 'thinking',
          featureStatus: {
            rag: { status: 'suppressed', reason: 'not_needed' },
            web: { status: 'enabled' },
            thinking: { status: 'enabled', reason: 'routing_mode' },
          },
        },
      },
    };

    render(
      <MessageComponent message={assistantMessage} isLastMessage={true} />
    );

    expect(screen.getByText('RAG 생략됨')).toBeInTheDocument();
    expect(screen.getByText('Web 허용')).toBeInTheDocument();
    expect(screen.getByText('심층 분석 요청됨')).toBeInTheDocument();
    expect(screen.queryByText('RAG 사용됨')).not.toBeInTheDocument();
    expect(screen.queryByText('Web 사용됨')).not.toBeInTheDocument();
  });

  it('renders parity metadata inside the analysis basis panel for short streaming answers', () => {
    const messages = transformMessages(
      [
        createMessage({
          id: 'u1',
          role: 'user',
          text: 'cache 메모리 사용률 몇 %야?',
        }),
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'cache-redis-dc1-01의 메모리 사용률은 75%입니다.',
            },
            {
              type: 'tool-getServerMetrics',
              toolCallId: 'tool-1',
              output: {
                success: true,
                dataSlot: {
                  slotIndex: 88,
                  minuteOfDay: 880,
                  timeLabel: '14:40 KST',
                },
                dataSource: {
                  scopeName: 'openmanager-ai-otel-pipeline',
                  scopeVersion: '1.0.0',
                  catalogGeneratedAt: '2026-02-15T03:56:41.821Z',
                  hour: 14,
                },
              },
            },
          ],
        } as unknown as UIMessage,
      ],
      {
        isLoading: false,
        currentMode: 'streaming',
      }
    );

    const assistantMessage = messages.find((message) => message.id === 'a1');
    expect(assistantMessage?.metadata?.analysisBasis?.dataSource).toBe(
      '서버 실시간 데이터 분석'
    );

    render(
      <MessageComponent message={assistantMessage!} isLastMessage={true} />
    );

    const badge = screen.getByTestId('analysis-basis-badge');
    expect(badge).toHaveTextContent('서버 실시간 데이터 분석');
    expect(badge.getAttribute('data-details')).toBe('');
    expect(badge.getAttribute('data-debug-details')).toContain(
      'Parity Metadata Contract'
    );
    expect(badge.getAttribute('data-debug-details')).toContain(
      '"slotIndex": 88'
    );
  });

  it('renders server snapshot artifacts from assistant metadata', () => {
    const assistantMessage = {
      id: 'a-server-snapshot',
      role: 'assistant',
      content: '서버 상태 스냅샷을 생성했습니다.',
      timestamp: new Date('2026-05-02T22:00:00.000Z'),
      metadata: {
        serverSnapshotArtifact: {
          kind: 'server-snapshot',
          generatedAt: '2026-05-02T22:00:00.000Z',
          title: '현재 서버 상태 스냅샷',
          summary: '4대 서버 중 위험 1대, 주의 1대입니다.',
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
        },
      },
    } as unknown as EnhancedChatMessage;

    render(
      <MessageComponent message={assistantMessage} isLastMessage={true} />
    );

    expect(screen.getByText('서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('현재 서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('source otel-static')).toBeInTheDocument();
  });
});
