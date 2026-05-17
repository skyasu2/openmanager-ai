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
    vi.restoreAllMocks();
  });

  it('시스템 시작 버튼을 기준점으로 삼고 조각을 마우스 방향에 반응시킨다', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function getMockRect() {
        if (
          (this as HTMLElement).getAttribute('data-spotlight-anchor') ===
          'system-start'
        ) {
          return {
            x: 100,
            y: 200,
            left: 100,
            top: 200,
            right: 260,
            bottom: 264,
            width: 160,
            height: 64,
            toJSON: () => ({}),
          };
        }

        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        };
      }
    );

    const { container } = render(
      <>
        <button type="button" data-spotlight-anchor="system-start">
          시스템 시작
        </button>
        <MouseSpotlight />
      </>
    );

    const spotlight = screen.getByTestId('mouse-spotlight');
    const firstFragment = container.querySelector<HTMLElement>(
      '.mouse-spotlight__fragment'
    );

    await waitFor(() => {
      expect(spotlight.style.getPropertyValue('--anchor-x')).toBe('180px');
      expect(spotlight.style.getPropertyValue('--anchor-y')).toBe('232px');
    });

    fireEvent.mouseMove(window, { clientX: 260, clientY: 320 });

    await waitFor(() => {
      expect(firstFragment?.style.getPropertyValue('--react-x')).not.toBe(
        '0.00px'
      );
      expect(firstFragment?.style.getPropertyValue('--react-y')).not.toBe(
        '0.00px'
      );
    });
  });

  it('오비트 링 없이 반응 조각만 렌더링한다', () => {
    const { container } = render(<MouseSpotlight />);

    expect(
      container.querySelectorAll('.mouse-spotlight__fragment')
    ).toHaveLength(8);
    expect(container.querySelector('.mouse-spotlight__orbit')).toBeNull();
    expect(container.querySelector('.mouse-spotlight__signal')).toBeNull();
  });
});
