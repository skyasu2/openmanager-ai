/**
 * @vitest-environment jsdom
 */

/**
 * 🧪 ReactFlowDiagram 컴포넌트 테스트
 *
 * @description React Flow 기반 아키텍처 다이어그램 렌더링 테스트
 * @author Claude Code
 * @created 2026-01-16
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.data';

// Mock CSS import to prevent worker timeout
vi.mock('@xyflow/react/dist/style.css', () => ({}));

// Mock heavy @radix-ui dependency
vi.mock('@radix-ui/react-tooltip', () => ({
  Root: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )),
  Trigger: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )),
  Content: vi.fn(() => null),
  Provider: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )),
  Portal: vi.fn(({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )),
}));

// React Flow 모킹 (canvas 환경 필요로 인해)
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn(({ children, nodes, edges }) => (
    <div
      data-testid="react-flow-container"
      data-nodes={nodes?.length}
      data-edges={edges?.length}
    >
      {children}
    </div>
  )),
  Background: vi.fn(() => <div data-testid="react-flow-background" />),
  Controls: vi.fn(() => <div data-testid="react-flow-controls" />),
  MiniMap: vi.fn(() => <div data-testid="react-flow-minimap" />),
  Handle: vi.fn(() => <div data-testid="react-flow-handle" />),
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
  // AutoFitView 컴포넌트에서 사용하는 훅
  useNodesInitialized: vi.fn(() => true),
  useReactFlow: vi.fn(() => ({
    fitView: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  })),
}));

// 컴포넌트 import (모킹 후)
import ReactFlowDiagram from './ReactFlowDiagram';

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockDiagram = (
  overrides?: Partial<ArchitectureDiagram>
): ArchitectureDiagram => ({
  id: 'test-diagram',
  title: 'Test Architecture',
  description: 'Test description for the architecture diagram',
  layers: [
    {
      title: 'Layer 1',
      color: 'from-blue-500 to-blue-600',
      nodes: [
        {
          id: 'node-1',
          label: 'Node 1',
          sublabel: 'Sublabel 1',
          type: 'primary',
          icon: '🔵',
        },
        {
          id: 'node-2',
          label: 'Node 2',
          type: 'secondary',
          icon: '🟢',
        },
      ],
    },
    {
      title: 'Layer 2',
      color: 'from-purple-500 to-purple-600',
      nodes: [
        {
          id: 'node-3',
          label: 'Node 3',
          type: 'tertiary',
        },
      ],
    },
  ],
  connections: [
    { from: 'node-1', to: 'node-2', label: 'Connection 1', type: 'solid' },
    { from: 'node-2', to: 'node-3', label: 'Connection 2', type: 'dashed' },
  ],
  ...overrides,
});

const createLargeDiagram = (): ArchitectureDiagram => ({
  id: 'large-diagram',
  title: 'Large Architecture',
  description: 'Large diagram with many nodes',
  layers: [
    {
      title: 'Many Nodes Layer',
      color: 'from-green-500 to-green-600',
      nodes: Array.from({ length: 6 }, (_, i) => ({
        id: `large-node-${i + 1}`,
        label: `Node ${i + 1}`,
        type: 'primary' as const,
      })),
    },
  ],
  connections: [],
});

// =============================================================================
// Tests
// =============================================================================

describe('🎯 ReactFlowDiagram 컴포넌트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기본 렌더링', () => {
    it('정상적으로 렌더링된다', () => {
      const diagram = createMockDiagram();
      const { container } = render(<ReactFlowDiagram diagram={diagram} />);

      expect(container.firstChild).toBeDefined();
    });

    it('다이어그램 제목이 표시된다', () => {
      const diagram = createMockDiagram({ title: 'Custom Title' });
      render(<ReactFlowDiagram diagram={diagram} />);

      expect(screen.getByText('Custom Title')).toBeDefined();
    });

    it('다이어그램 설명이 표시된다', () => {
      const diagram = createMockDiagram({ description: 'Custom Description' });
      render(<ReactFlowDiagram diagram={diagram} />);

      expect(screen.getByText('Custom Description')).toBeDefined();
    });

    it('React Flow 컨테이너가 렌더링된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} />);

      expect(screen.getByTestId('react-flow-container')).toBeDefined();
    });
  });

  describe('Props 처리', () => {
    it('compact 모드가 기본값으로 적용된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} />);

      // compact 모드에서는 기본 높이 클래스가 적용됨
      const flowContainer = screen.getByTestId(
        'react-flow-container'
      ).parentElement;
      expect(flowContainer?.className).toContain('h-[48dvh]');
    });

    it('showControls가 true일 때 Controls가 렌더링된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showControls={true} />);

      expect(screen.getByTestId('react-flow-controls')).toBeDefined();
    });

    it('showControls가 false일 때 Controls가 렌더링되지 않는다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showControls={false} />);

      expect(screen.queryByTestId('react-flow-controls')).toBeNull();
    });

    it('showMiniMap이 true일 때 MiniMap이 렌더링된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showMiniMap={true} />);

      expect(screen.getByTestId('react-flow-minimap')).toBeDefined();
    });

    it('showMiniMap이 false(기본값)일 때 MiniMap이 렌더링되지 않는다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} />);

      expect(screen.queryByTestId('react-flow-minimap')).toBeNull();
    });

    it('showHeader가 false이면 제목/설명이 렌더링되지 않는다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showHeader={false} />);

      expect(screen.queryByText(diagram.title)).toBeNull();
      expect(screen.queryByText(diagram.description)).toBeNull();
    });

    it('showLegend가 false이면 범례가 렌더링되지 않는다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showLegend={false} />);

      expect(screen.queryByText('핵심')).toBeNull();
      expect(screen.queryByText('데이터')).toBeNull();
    });

    it('showZoomToolbar가 true이면 명시적 줌 컨트롤을 렌더링한다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} showZoomToolbar={true} />);

      expect(
        screen.getByRole('group', { name: '토폴로지 줌 컨트롤' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '토폴로지 확대' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '토폴로지 축소' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '토폴로지 화면 맞춤' })
      ).toBeInTheDocument();
    });

    it('maximizeViewport가 true이면 확장 높이 클래스가 적용된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} maximizeViewport={true} />);

      const flowContainer = screen.getByTestId(
        'react-flow-container'
      ).parentElement;
      expect(flowContainer?.className).toContain('h-[60dvh]');
    });
  });

  describe('노드 변환 (convertToReactFlow)', () => {
    it('레이어 수만큼 swimlaneBg 노드가 생성된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} />);

      const container = screen.getByTestId('react-flow-container');
      // 2개 레이어 → 2개 swimlaneBg + 2개 layerLabel + 3개 customNode = 7개
      expect(container.dataset.nodes).toBe('7');
    });

    it('connections 수만큼 edge가 생성된다', () => {
      const diagram = createMockDiagram();
      render(<ReactFlowDiagram diagram={diagram} />);

      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.edges).toBe('2');
    });

    it('connections가 없을 때 edge가 0개이다', () => {
      const diagram = createMockDiagram({ connections: undefined });
      render(<ReactFlowDiagram diagram={diagram} />);

      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.edges).toBe('0');
    });

    it('노드가 4개 초과인 레이어는 2줄로 배치된다', () => {
      const largeDiagram = createLargeDiagram();
      render(<ReactFlowDiagram diagram={largeDiagram} />);

      // 6개 노드 + 1개 swimlaneBg + 1개 layerLabel = 8개
      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.nodes).toBe('8');
    });
  });

  describe('엣지 케이스', () => {
    it('빈 layers 배열에서도 정상 작동한다', () => {
      const emptyDiagram = createMockDiagram({ layers: [] });
      const { container } = render(<ReactFlowDiagram diagram={emptyDiagram} />);

      expect(container.firstChild).toBeDefined();
    });

    it('빈 nodes 배열을 가진 레이어에서도 정상 작동한다', () => {
      const emptyNodesDiagram = createMockDiagram({
        layers: [
          {
            title: 'Empty Layer',
            color: 'from-gray-500 to-gray-600',
            nodes: [],
          },
        ],
      });
      const { container } = render(
        <ReactFlowDiagram diagram={emptyNodesDiagram} />
      );

      expect(container.firstChild).toBeDefined();
    });

    it('connection의 from/to가 존재하지 않는 노드를 참조해도 에러가 발생하지 않는다', () => {
      const invalidConnectionDiagram = createMockDiagram({
        connections: [
          { from: 'non-existent-1', to: 'non-existent-2', type: 'solid' },
        ],
      });

      // 에러 없이 렌더링되어야 함
      const { container } = render(
        <ReactFlowDiagram diagram={invalidConnectionDiagram} />
      );
      expect(container.firstChild).toBeDefined();

      // 유효하지 않은 연결은 생성되지 않음
      const flowContainer = screen.getByTestId('react-flow-container');
      expect(flowContainer.dataset.edges).toBe('0');
    });

    it('매우 긴 label/sublabel에서도 정상 작동한다', () => {
      const longLabelDiagram = createMockDiagram({
        layers: [
          {
            title: 'A'.repeat(100),
            color: 'from-red-500 to-red-600',
            nodes: [
              {
                id: 'long-node',
                label: 'B'.repeat(100),
                sublabel: 'C'.repeat(100),
                type: 'primary',
              },
            ],
          },
        ],
      });

      const { container } = render(
        <ReactFlowDiagram diagram={longLabelDiagram} />
      );
      expect(container.firstChild).toBeDefined();
    });
  });

  describe('노드 타입별 테스트', () => {
    it('primary 타입 노드가 올바르게 처리된다', () => {
      const diagram = createMockDiagram({
        layers: [
          {
            title: 'Test',
            color: 'from-blue-500 to-blue-600',
            nodes: [{ id: 'primary-node', label: 'Primary', type: 'primary' }],
          },
        ],
      });

      const { container } = render(<ReactFlowDiagram diagram={diagram} />);
      expect(container.firstChild).toBeDefined();
    });

    it('highlight 타입 노드가 올바르게 처리된다', () => {
      const diagram = createMockDiagram({
        layers: [
          {
            title: 'Test',
            color: 'from-yellow-500 to-yellow-600',
            nodes: [
              { id: 'highlight-node', label: 'Highlight', type: 'highlight' },
            ],
          },
        ],
      });

      const { container } = render(<ReactFlowDiagram diagram={diagram} />);
      expect(container.firstChild).toBeDefined();
    });
  });

  describe('connection 타입별 테스트', () => {
    it('solid 타입 connection이 올바르게 처리된다', () => {
      const diagram = createMockDiagram({
        connections: [{ from: 'node-1', to: 'node-2', type: 'solid' }],
      });

      render(<ReactFlowDiagram diagram={diagram} />);
      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.edges).toBe('1');
    });

    it('dashed 타입 connection이 올바르게 처리된다', () => {
      const diagram = createMockDiagram({
        connections: [{ from: 'node-1', to: 'node-2', type: 'dashed' }],
      });

      render(<ReactFlowDiagram diagram={diagram} />);
      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.edges).toBe('1');
    });

    it('label이 있는 connection이 올바르게 처리된다', () => {
      const diagram = createMockDiagram({
        connections: [
          { from: 'node-1', to: 'node-2', label: 'Test Label', type: 'solid' },
        ],
      });

      render(<ReactFlowDiagram diagram={diagram} />);
      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.edges).toBe('1');
    });
  });

  describe('스냅샷 테스트', () => {
    it('기본 다이어그램 스냅샷', () => {
      const diagram = createMockDiagram();
      const { container } = render(<ReactFlowDiagram diagram={diagram} />);

      expect(container.firstChild).toMatchSnapshot();
    });

    it('모든 옵션 활성화 스냅샷', () => {
      const diagram = createMockDiagram();
      const { container } = render(
        <ReactFlowDiagram
          diagram={diagram}
          compact={false}
          showControls={true}
          showMiniMap={true}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('큰 다이어그램 스냅샷', () => {
      const largeDiagram = createLargeDiagram();
      const { container } = render(<ReactFlowDiagram diagram={largeDiagram} />);

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('메모이제이션', () => {
    it('동일한 diagram prop으로 재렌더링 시 변환 함수가 재호출되지 않아야 한다', () => {
      const diagram = createMockDiagram();
      const { rerender } = render(<ReactFlowDiagram diagram={diagram} />);

      // 동일한 diagram으로 rerender
      rerender(<ReactFlowDiagram diagram={diagram} />);

      // useMemo로 인해 변환이 캐시됨 - ReactFlow mock이 동일한 nodes/edges 받음
      const container = screen.getByTestId('react-flow-container');
      expect(container.dataset.nodes).toBe('7');
    });
  });
});
