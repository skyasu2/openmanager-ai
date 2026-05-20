/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MouseSpotlight } from './MouseSpotlight';

const mockCtx = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  setTransform: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
};

let frameCallback: FrameRequestCallback | undefined;
let cancelAnimationFrameMock = vi.fn();

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('MouseSpotlight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    frameCallback = undefined;
    let frameId = 0;

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return ++frameId;
      })
    );
    cancelAnimationFrameMock = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx as unknown as CanvasRenderingContext2D
    );

    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a canvas with the mouse spotlight test id', () => {
    render(<MouseSpotlight />);
    const el = screen.getByTestId('mouse-spotlight');
    expect(el.tagName).toBe('CANVAS');
    expect(el).toHaveClass('mouse-spotlight');
    expect(mockCtx.setTransform).toHaveBeenCalled();
  });

  it('does not draw the canvas when reduced motion is enabled', () => {
    mockMatchMedia(true);

    render(<MouseSpotlight />);
    expect(mockCtx.clearRect).not.toHaveBeenCalled();
  });

  it('subscribes to mousemove events', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<MouseSpotlight />);
    const calls = addSpy.mock.calls.map(([event]) => event);
    expect(calls).toContain('mousemove');
  });

  it('cleans up event listeners and rAF on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<MouseSpotlight />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(cancelAnimationFrameMock).toHaveBeenCalled();
  });

  it('draws on the canvas after a mousemove event', () => {
    render(<MouseSpotlight />);
    mockCtx.clearRect.mockClear();
    mockCtx.arc.mockClear();
    mockCtx.fill.mockClear();

    fireEvent.mouseMove(window, { clientX: 300, clientY: 400 });
    frameCallback?.(performance.now());

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });
});
