/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MouseSpotlight } from './MouseSpotlight';

describe('MouseSpotlight', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) =>
      window.clearTimeout(id)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('마우스 위치를 CSS 변수로 반영한다', async () => {
    render(<MouseSpotlight />);

    const spotlight = screen.getByTestId('mouse-spotlight');
    fireEvent.mouseMove(window, { clientX: 144, clientY: 320 });

    await waitFor(() => {
      expect(spotlight.style.getPropertyValue('--x')).toBe('144px');
      expect(spotlight.style.getPropertyValue('--y')).toBe('320px');
    });
  });

  it('운영 신호 오비트와 신호점을 렌더링한다', () => {
    const { container } = render(<MouseSpotlight />);

    expect(container.querySelectorAll('.mouse-spotlight__orbit')).toHaveLength(
      2
    );
    expect(container.querySelectorAll('.mouse-spotlight__signal')).toHaveLength(
      3
    );
  });
});
