/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { SVGProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import { FeatureCardModalHeader } from './FeatureCardModalHeader';

const MockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" data-testid="mock-header-icon" {...props} />
);

const mockDiagram: ArchitectureDiagram = {
  id: 'tech-stack',
  title: 'Tech Stack',
  description: 'Mock diagram for header tests',
  layers: [],
  connections: [],
};

describe('FeatureCardModalHeader', () => {
  it('일반 카드에서는 다이어그램 토글과 닫기 액션을 노출한다', () => {
    const onToggleDiagram = vi.fn();
    const onClose = vi.fn();

    render(
      <FeatureCardModalHeader
        title="기술 스택"
        Icon={MockIcon}
        showDiagram={false}
        diagramData={mockDiagram}
        cardId="tech-stack"
        vibeView="current"
        variant="home"
        onToggleDiagram={onToggleDiagram}
        onSetVibeView={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /아키텍처 보기/i }));
    fireEvent.click(screen.getByRole('button', { name: /Close modal/i }));

    expect(onToggleDiagram).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-header-icon')).toBeInTheDocument();
  });

  it('바이브 카드에서는 탭 버튼만 노출하고 선택 상태를 반영한다', () => {
    const onSetVibeView = vi.fn();

    render(
      <FeatureCardModalHeader
        title="Vibe Coding"
        Icon={MockIcon}
        showDiagram={false}
        diagramData={mockDiagram}
        cardId="vibe-coding"
        vibeView="current"
        variant="landing"
        onToggleDiagram={vi.fn()}
        onSetVibeView={onSetVibeView}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /개발 환경 변화/i }));
    fireEvent.click(screen.getByRole('button', { name: /CI\/CD/i }));

    expect(
      screen.queryByRole('button', { name: /아키텍처 보기|상세 내용 보기/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /현재 도구/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(onSetVibeView).toHaveBeenNthCalledWith(1, 'history');
    expect(onSetVibeView).toHaveBeenNthCalledWith(2, 'cicd');
  });
});
