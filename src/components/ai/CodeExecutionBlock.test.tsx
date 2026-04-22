/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeExecutionBlock } from './CodeExecutionBlock';

const writeTextMock = vi.fn();
const executeMock = vi.fn();
const initializeMock = vi.fn();

vi.mock('@/hooks/useCodeInterpreter', () => ({
  useCodeInterpreter: () => ({
    execute: executeMock,
    isReady: true,
    isLoading: false,
    error: null,
    initialize: initializeMock,
  }),
}));

describe('CodeExecutionBlock', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock.mockResolvedValue(undefined);
    executeMock.mockReset();
    initializeMock.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('복사 후 unmount 되면 copy reset timer를 정리해야 한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = render(
      <CodeExecutionBlock code={'print("hello")'} language="python" />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '복사' }));
      await vi.runAllTicks();
    });

    unmount();

    expect(writeTextMock).toHaveBeenCalledWith('print("hello")');
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
