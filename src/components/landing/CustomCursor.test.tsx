/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomCursor } from './CustomCursor';

const matchMediaMock = vi.fn();

beforeEach(() => {
  matchMediaMock.mockReturnValue({ matches: false });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: matchMediaMock,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CustomCursor', () => {
  it('renders only a small cursor dot without the legacy circular ring', () => {
    render(<CustomCursor />);

    expect(screen.getByTestId('custom-cursor-dot')).toBeInTheDocument();
    expect(
      document.querySelector('.custom-cursor-ring')
    ).not.toBeInTheDocument();
  });

  it('keeps the dot hidden on coarse pointer devices', () => {
    matchMediaMock.mockReturnValue({ matches: true });

    render(<CustomCursor />);

    expect(screen.getByTestId('custom-cursor-dot')).toHaveStyle({
      opacity: '0',
    });
  });
});
