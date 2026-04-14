/**
 * @vitest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatActions } from './useChatActions';

vi.mock('@/hooks/ai/useFileAttachments', () => ({
  useFileAttachments: vi.fn(() => ({
    attachments: [],
    isDragging: false,
    errors: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clearFiles: vi.fn(),
    clearErrors: vi.fn(),
    dragHandlers: {},
    canAddMore: true,
  })),
}));

describe('useChatActions auto-scroll', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('auto-scrolls when a new message is appended even if the user is away from the bottom', () => {
    const scrollIntoView = vi.fn();
    const messagesEndRef = {
      current: {
        scrollIntoView,
      },
    } as RefObject<HTMLDivElement | null>;

    const { result, rerender } = renderHook(
      ({
        isGenerating,
        limitedMessagesLength,
      }: {
        isGenerating: boolean;
        limitedMessagesLength: number;
      }) =>
        useChatActions({
          setInputValue: vi.fn(),
          handleSendInput: vi.fn(),
          isGenerating,
          messagesEndRef,
          limitedMessagesLength,
        }),
      {
        initialProps: {
          isGenerating: false,
          limitedMessagesLength: 1,
        },
      }
    );

    act(() => {
      result.current.scrollContainerRef.current = {
        scrollHeight: 1000,
        scrollTop: 200,
        clientHeight: 300,
      } as HTMLDivElement;
    });

    act(() => {
      rerender({
        isGenerating: true,
        limitedMessagesLength: 2,
      });
    });

    expect(scrollIntoView).toHaveBeenCalledOnce();
  });

  it('does not force auto-scroll when generation starts without any new message and the user is reading older messages', () => {
    const scrollIntoView = vi.fn();
    const messagesEndRef = {
      current: {
        scrollIntoView,
      },
    } as RefObject<HTMLDivElement | null>;

    const { result, rerender } = renderHook(
      ({
        isGenerating,
        limitedMessagesLength,
      }: {
        isGenerating: boolean;
        limitedMessagesLength: number;
      }) =>
        useChatActions({
          setInputValue: vi.fn(),
          handleSendInput: vi.fn(),
          isGenerating,
          messagesEndRef,
          limitedMessagesLength,
        }),
      {
        initialProps: {
          isGenerating: false,
          limitedMessagesLength: 2,
        },
      }
    );

    act(() => {
      result.current.scrollContainerRef.current = {
        scrollHeight: 1000,
        scrollTop: 200,
        clientHeight: 300,
      } as HTMLDivElement;
    });

    act(() => {
      rerender({
        isGenerating: true,
        limitedMessagesLength: 2,
      });
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe('useChatActions textarea focus restore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('restores focus after generation completes when focus restore is allowed', () => {
    vi.useFakeTimers();
    const focus = vi.fn();
    const messagesEndRef = {
      current: null,
    } as RefObject<HTMLDivElement | null>;

    const { result, rerender } = renderHook(
      ({
        isGenerating,
        shouldRestoreFocus,
      }: {
        isGenerating: boolean;
        shouldRestoreFocus: boolean;
      }) =>
        useChatActions({
          setInputValue: vi.fn(),
          handleSendInput: vi.fn(),
          isGenerating,
          shouldRestoreFocus,
          messagesEndRef,
          limitedMessagesLength: 0,
        }),
      {
        initialProps: {
          isGenerating: true,
          shouldRestoreFocus: true,
        },
      }
    );

    act(() => {
      result.current.textareaRef.current = {
        focus,
      } as HTMLTextAreaElement;
    });

    act(() => {
      rerender({
        isGenerating: false,
        shouldRestoreFocus: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(focus).toHaveBeenCalledOnce();
  });

  it('does not steal focus from clarification flow when focus restore is suspended', () => {
    vi.useFakeTimers();
    const focus = vi.fn();
    const messagesEndRef = {
      current: null,
    } as RefObject<HTMLDivElement | null>;

    const { result } = renderHook(() =>
      useChatActions({
        setInputValue: vi.fn(),
        handleSendInput: vi.fn(),
        isGenerating: false,
        shouldRestoreFocus: false,
        messagesEndRef,
        limitedMessagesLength: 0,
      })
    );

    act(() => {
      result.current.textareaRef.current = {
        focus,
      } as HTMLTextAreaElement;
      vi.advanceTimersByTime(100);
    });

    expect(focus).not.toHaveBeenCalled();
  });
});
