/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ArchitectureDiagram } from '@/data/architecture-diagrams.types';
import { StaticArchitectureDiagram } from './StaticArchitectureDiagram';

const diagram: ArchitectureDiagram = {
  id: 'test-architecture',
  title: '테스트 아키텍처',
  description: '테스트용 다이어그램',
  layers: [
    {
      title: '입력 계층',
      color: 'from-blue-500 to-cyan-500',
      nodes: [
        {
          id: 'user',
          label: '사용자 요청',
          sublabel: 'modal entry',
          type: 'primary',
          icon: '💬',
        },
      ],
    },
    {
      title: '실행 계층',
      color: 'from-indigo-500 to-purple-600',
      nodes: [
        {
          id: 'worker',
          label: '작업 실행기',
          sublabel: 'typed artifact',
          type: 'highlight',
          icon: '⚙️',
        },
      ],
    },
  ],
  connections: [{ from: 'user', to: 'worker', label: '위임' }],
};

describe('StaticArchitectureDiagram', () => {
  it('정적 SVG 다이어그램과 범례를 렌더링한다', () => {
    render(<StaticArchitectureDiagram diagram={diagram} />);

    expect(
      screen.getByRole('img', {
        name: /테스트 아키텍처 아키텍처 다이어그램/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('static-architecture-diagram')
    ).toBeInTheDocument();
    expect(screen.getByText('입력 계층')).toBeInTheDocument();
    expect(screen.getByText('작업 실행기')).toBeInTheDocument();
    expect(screen.getByText('일반 연결')).toBeInTheDocument();
  });

  it('빈 레이어 목록도 레이아웃 계산 오류 없이 처리한다', () => {
    render(<StaticArchitectureDiagram diagram={{ ...diagram, layers: [] }} />);

    expect(
      screen.getByRole('img', {
        name: /테스트 아키텍처 아키텍처 다이어그램/i,
      })
    ).toBeInTheDocument();
  });
});
