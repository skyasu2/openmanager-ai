/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import { TopologyView } from './TopologyModal';

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockDynamicDiagram({
      diagram,
      showControls,
      showZoomToolbar,
    }: {
      diagram: ArchitectureDiagram;
      showControls?: boolean;
      showZoomToolbar?: boolean;
    }) {
      const nodeCount = diagram.layers.reduce(
        (sum, layer) => sum + layer.nodes.length,
        0
      );

      return (
        <div
          data-testid="mock-topology-diagram"
          data-edges={diagram.connections?.length ?? 0}
          data-nodes={nodeCount}
          data-show-controls={String(showControls)}
          data-show-zoom-toolbar={String(showZoomToolbar)}
        />
      );
    },
}));

describe('TopologyView', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('서버 타입 필터로 토폴로지 노드와 연결을 좁힌다', () => {
    vi.useFakeTimers();

    render(<TopologyView servers={[]} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('mock-topology-diagram')).toHaveAttribute(
      'data-nodes',
      '18'
    );

    fireEvent.click(screen.getByRole('button', { name: 'DB' }));

    expect(screen.getByRole('button', { name: 'DB' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('mock-topology-diagram')).toHaveAttribute(
      'data-nodes',
      '3'
    );
    expect(screen.getByTestId('mock-topology-diagram')).toHaveAttribute(
      'data-edges',
      '2'
    );
    expect(screen.getByText('3 Nodes · 2 Edges')).toBeInTheDocument();
  });

  it('명시적 줌 툴바를 켜고 기본 React Flow 컨트롤은 숨긴다', () => {
    vi.useFakeTimers();

    render(<TopologyView servers={[]} />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('mock-topology-diagram')).toHaveAttribute(
      'data-show-zoom-toolbar',
      'true'
    );
    expect(screen.getByTestId('mock-topology-diagram')).toHaveAttribute(
      'data-show-controls',
      'false'
    );
  });
});
