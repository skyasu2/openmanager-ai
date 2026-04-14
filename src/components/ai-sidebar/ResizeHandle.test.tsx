/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResizeHandle } from './ResizeHandle';

describe('ResizeHandle', () => {
  it('hover grip indicator를 root hover 상태와 연결해야 한다', () => {
    render(
      <ResizeHandle
        onMouseDown={vi.fn()}
        onTouchStart={vi.fn()}
        isResizing={false}
      />
    );

    const handle = screen.getByRole('separator', {
      name: '사이드바 너비 조절',
    });
    const gripIndicator = handle.firstElementChild;

    expect(handle).toHaveClass('group');
    expect(gripIndicator).not.toBeNull();
    expect(gripIndicator).toHaveClass('group-hover:opacity-100');
  });
});
