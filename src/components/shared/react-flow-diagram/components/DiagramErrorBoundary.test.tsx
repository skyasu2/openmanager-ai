/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramErrorBoundary } from './DiagramErrorBoundary';

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function Bomb() {
  throw new Error('diagram crash');
}

describe('DiagramErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('정상 렌더링 시 자식을 표시한다', () => {
    render(
      <DiagramErrorBoundary>
        <div>diagram ok</div>
      </DiagramErrorBoundary>
    );

    expect(screen.getByText('diagram ok')).toBeInTheDocument();
  });

  it('자식 렌더링 오류 시 기본 fallback을 표시한다', () => {
    render(
      <DiagramErrorBoundary diagramTitle="서비스 플로우">
        <Bomb />
      </DiagramErrorBoundary>
    );

    expect(screen.getByText('다이어그램 로드 실패')).toBeInTheDocument();
    expect(
      screen.getByText('"서비스 플로우" 다이어그램을 표시할 수 없습니다.')
    ).toBeInTheDocument();
  });

  it('custom fallback이 있으면 우선 사용한다', () => {
    render(
      <DiagramErrorBoundary fallback={<div>custom fallback</div>}>
        <Bomb />
      </DiagramErrorBoundary>
    );

    expect(screen.getByText('custom fallback')).toBeInTheDocument();
  });
});
