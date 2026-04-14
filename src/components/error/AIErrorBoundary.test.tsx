/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Component } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIErrorBoundary } from './AIErrorBoundary';

vi.mock('@/lib/logging', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

class ThrowingAIChild extends Component<{ shouldThrow: boolean }> {
  render() {
    if (this.props.shouldThrow) {
      throw new Error('ai crashed');
    }

    return <div data-testid="ai-boundary-content">healthy ai content</div>;
  }
}

describe('AIErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('복사 타이머를 unmount 시 정리해야 한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <AIErrorBoundary componentName="AIWorkspace">
        <ThrowingAIChild shouldThrow={true} />
      </AIErrorBoundary>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '복사' }));
      await Promise.resolve();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Error: ai crashed')
    );
  });

  it('resetKey가 바뀌면 새 상태 기준으로 자동 복구해야 한다', () => {
    const { rerender } = render(
      <AIErrorBoundary componentName="AIWorkspace" resetKey="chat:session-a">
        <ThrowingAIChild shouldThrow={true} />
      </AIErrorBoundary>
    );

    expect(screen.getByText('AI 서비스 오류')).toBeInTheDocument();

    rerender(
      <AIErrorBoundary componentName="AIWorkspace" resetKey="report:session-b">
        <ThrowingAIChild shouldThrow={false} />
      </AIErrorBoundary>
    );

    expect(screen.getByTestId('ai-boundary-content')).toBeInTheDocument();
  });
});
