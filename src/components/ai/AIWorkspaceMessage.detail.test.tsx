/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { AIWorkspaceMessage } from './AIWorkspaceMessage';

vi.mock('./MessageActions', () => ({
  MessageActions: () => <div data-testid="message-actions" />,
}));

vi.mock('./MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

vi.mock('./ThinkingProcessVisualizer', () => ({
  ThinkingProcessVisualizer: () => <div data-testid="thinking-visualizer" />,
}));

vi.mock('@/utils/markdown-parser', () => ({
  RenderMarkdownContent: ({ content }: { content: string }) => (
    <div>{content}</div>
  ),
}));

describe('AIWorkspaceMessage detail affordance', () => {
  it('renders the latest completed assistant response with MarkdownRenderer instead of TypewriterMarkdown', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-latest-complete',
      role: 'assistant',
      content: '완료된 응답 본문',
      timestamp: new Date('2026-04-10T17:01:00.000Z'),
      isStreaming: false,
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByTestId('markdown-renderer')).toHaveTextContent(
      '완료된 응답 본문'
    );
    expect(screen.queryByTestId('typewriter-markdown')).not.toBeInTheDocument();
  });

  it('renders provider attribution for completed assistant responses', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-provider-attribution',
      role: 'assistant',
      content: 'Provider attribution response',
      timestamp: new Date('2026-05-16T11:00:00.000Z'),
      isStreaming: false,
      metadata: {
        provider: 'groq',
        modelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
        ttfbMs: 642,
        usedFallback: true,
        rotationSlot: 2,
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('Groq')).toBeInTheDocument();
    expect(screen.getByText('/ llama-4-scout')).toBeInTheDocument();
    expect(screen.getByText('642ms')).toBeInTheDocument();
    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect(screen.getByText('순환 3번')).toBeInTheDocument();
  });

  it('renders structured details inline when analysis metadata is absent', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-inline-details',
      role: 'assistant',
      content: '핵심 요약 메타데이터',
      timestamp: new Date('2026-04-10T17:02:00.000Z'),
      isStreaming: false,
      metadata: {
        assistantResponseView: {
          summary: '핵심 요약 메타데이터',
          details: '상세 메타데이터 본문',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('핵심 요약 메타데이터')).toBeInTheDocument();
    expect(screen.getByText('상세 메타데이터 본문')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
  });

  it('keeps metadata-only assistant messages free of content actions', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: '',
      timestamp: new Date('2026-04-10T17:00:00.000Z'),
      isStreaming: false,
      metadata: {
        handoffHistory: [{ from: 'Supervisor', to: 'Analyst Agent' }],
      },
      thinkingSteps: [
        {
          id: 'step-1',
          title: '분석',
          description: '메타데이터 전용 응답',
          status: 'completed',
        },
      ] as NonNullable<EnhancedChatMessage['thinkingSteps']>,
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.queryByTestId('ai-response')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
  });

  it('keeps structured-response-only assistant messages free of content actions', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-2',
      role: 'assistant',
      content: '',
      timestamp: new Date('2026-04-10T17:05:00.000Z'),
      isStreaming: false,
      metadata: {
        assistantResponseView: {
          summary: '핵심 요약 메타데이터',
          details: '상세 메타데이터 본문',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /상세 분석 보기/i })
    ).not.toBeInTheDocument();
  });

  it('does not render an empty thinking visualizer when thinking steps are empty', () => {
    const message: EnhancedChatMessage = {
      id: 'thinking-1',
      role: 'thinking',
      content: '',
      timestamp: new Date('2026-04-10T17:10:00.000Z'),
      isStreaming: true,
      thinkingSteps: [],
    };

    const { container } = render(
      <AIWorkspaceMessage message={message} isLastMessage={true} />
    );

    expect(screen.queryByTestId('thinking-visualizer')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the real analysis basis tabs in the workspace assistant surface', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-3',
      role: 'assistant',
      content: '캐시 서버 상태를 요약했습니다.',
      timestamp: new Date('2026-04-10T17:15:00.000Z'),
      isStreaming: false,
      metadata: {
        traceId: 'trace-workspace-integration-1234',
        processingTime: 1280,
        latencyTier: 'slow',
        resolvedMode: 'multi',
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
          toolsCalled: ['searchKnowledgeBase', 'getServerMetrics'],
        },
        handoffHistory: [{ from: 'supervisor', to: 'analyst' }],
        toolResultSummaries: [
          {
            toolName: 'getServerMetrics',
            label: '서버 메트릭 조회',
            summary: '현재 CPU와 메모리를 확인했습니다.',
            status: 'completed',
          },
        ],
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    expect(
      screen.getByRole('tab', { name: '과정 보기', selected: true })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(
      screen.getByText('trace-workspace-integration-1234')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('tabpanel', { name: '디버그 보기' })).getByText(
        '1280ms'
      )
    ).toBeInTheDocument();
  });

  it('shows a response speed label instead of raw processing milliseconds beside messages', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-latency-label',
      role: 'assistant',
      content: '처리 시간을 사용자 친화적으로 표시합니다.',
      timestamp: new Date('2026-04-10T17:15:00.000Z'),
      isStreaming: false,
      metadata: {
        processingTime: 1591,
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('응답 보통')).toBeInTheDocument();
    expect(screen.queryByText(/1591ms/)).not.toBeInTheDocument();
  });

  it('moves parity metadata into the debug tab when analysis metadata exists', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-4',
      role: 'assistant',
      content: '슬롯 parity를 확인했습니다.',
      timestamp: new Date('2026-04-10T17:16:00.000Z'),
      isStreaming: false,
      metadata: {
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
        },
        assistantResponseView: {
          summary: '슬롯 parity를 확인했습니다.',
          details:
            '일반 설명\n\n### Parity Metadata Contract\n```json\n{ "dataSlot": { "slotIndex": 105 } }\n```',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(
      screen.queryByText('Parity Metadata Contract')
    ).not.toBeInTheDocument();
    expect(screen.getByText('일반 설명')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: '분석 근거 상세 보기' })
    );

    fireEvent.click(screen.getByRole('tab', { name: '디버그 보기' }));

    expect(screen.getByText(/Parity Metadata Contract/)).toBeInTheDocument();
  });

  it('shows actionable details inline when analysis metadata exists', () => {
    const message: EnhancedChatMessage = {
      id: 'assistant-5',
      role: 'assistant',
      content: '위험 서버를 분석했습니다.',
      timestamp: new Date('2026-04-30T03:40:00.000Z'),
      isStreaming: false,
      metadata: {
        analysisBasis: {
          dataSource: '서버 실시간 데이터 분석',
          engine: 'Cloud Run AI',
        },
        assistantResponseView: {
          summary: '위험 서버를 분석했습니다.',
          details:
            'db-mysql-dc1-primary MEM 90%\n\n1. 커넥션 풀과 버퍼 캐시를 확인',
          shouldCollapse: true,
        },
      },
    };

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('상세 분석')).toBeInTheDocument();
    expect(
      screen.getByText(/db-mysql-dc1-primary MEM 90%/)
    ).toBeInTheDocument();
    expect(screen.getByText(/커넥션 풀과 버퍼 캐시/)).toBeInTheDocument();
  });

  it('renders server snapshot artifacts from assistant metadata', () => {
    const message = {
      id: 'assistant-server-snapshot',
      role: 'assistant',
      content: '서버 상태 스냅샷을 생성했습니다.',
      timestamp: new Date('2026-05-02T22:00:00.000Z'),
      isStreaming: false,
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

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(screen.getByText('서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('현재 서버 상태 스냅샷')).toBeInTheDocument();
    expect(screen.getByText('source otel-static')).toBeInTheDocument();
  });

  it('renders unsupported artifact envelopes through a safe fallback', () => {
    const message = {
      id: 'assistant-unsupported-artifact',
      role: 'assistant',
      content: '알 수 없는 아티팩트를 받았습니다.',
      timestamp: new Date('2026-05-05T00:00:00.000Z'),
      isStreaming: false,
      metadata: {
        artifactEnvelopes: [
          {
            domainId: 'sample-domain',
            kind: 'unsafe-widget',
            artifactVersion: '2026-05-05-test',
            generatedAt: '2026-05-05T00:00:00.000Z',
            sourceMode: 'tool-result',
            payload: {
              html: '<script>alert(1)</script>',
              url: 'javascript:alert(1)',
            },
          },
        ],
      },
    } as unknown as EnhancedChatMessage;

    render(<AIWorkspaceMessage message={message} isLastMessage={true} />);

    expect(
      screen.getByTestId('unsupported-artifact-fallback')
    ).toHaveTextContent('지원하지 않는 아티팩트');
    expect(
      screen.getByText('sample-domain / unsafe-widget')
    ).toBeInTheDocument();
    expect(screen.queryByText(/<script>/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/javascript:/i)).not.toBeInTheDocument();
  });

  it('renders guidance CTA metadata as an actionable artifact button', () => {
    const onArtifactGuidanceCta = vi.fn();
    const message: EnhancedChatMessage = {
      id: 'assistant-guidance-cta',
      role: 'assistant',
      content:
        '이상감지/추세 기능은 사용자가 명시적으로 요청할 때만 실행합니다.',
      timestamp: new Date('2026-05-15T01:00:00.000Z'),
      isStreaming: false,
      metadata: {
        type: 'guidance',
        guidanceCta: {
          target: 'monitoring-analysis',
          label: '바로 이상감지/추세 분석 실행하기',
        },
      },
    };

    render(
      <AIWorkspaceMessage
        message={message}
        isLastMessage={true}
        onArtifactGuidanceCta={onArtifactGuidanceCta}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: '바로 이상감지/추세 분석 실행하기',
      })
    );

    expect(onArtifactGuidanceCta).toHaveBeenCalledWith('monitoring-analysis');
  });
});
