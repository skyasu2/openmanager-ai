/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

describe('MarkdownRenderer', () => {
  const originalInnerTextDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'innerText'
  );

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn(() => Promise.resolve()),
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent ?? '';
      },
      set(value: string) {
        this.textContent = value;
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    if (originalInnerTextDescriptor) {
      Object.defineProperty(
        HTMLElement.prototype,
        'innerText',
        originalInnerTextDescriptor
      );
      return;
    }

    delete (HTMLElement.prototype as HTMLElement & { innerText?: string })
      .innerText;
  });

  it('code block copy timer를 unmount 시 정리해야 한다', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = render(
      <MarkdownRenderer content={'```ts\nconst answer = 42;\n```'} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '복사' }));
      await Promise.resolve();
    });

    unmount();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'const answer = 42;\n'
    );
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
