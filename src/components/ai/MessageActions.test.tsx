/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageActions } from './MessageActions';

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('MessageActions', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('locks feedback after a successful submission to avoid duplicate records', async () => {
    const onFeedback = vi.fn().mockResolvedValue(true);
    const props = {
      messageId: 'msg-1',
      content: 'answer',
      role: 'assistant' as const,
      onFeedback,
    };

    render(<MessageActions {...props} />);

    const positiveButton = screen.getByTitle('도움이 됐어요');
    const negativeButton = screen.getByTitle('개선이 필요해요');

    fireEvent.click(positiveButton);

    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(negativeButton);

    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(positiveButton).toBeDisabled();
    expect(negativeButton).toBeDisabled();
  });

  it('reopens feedback when the API rejects the submission', async () => {
    const onFeedback = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const props = {
      messageId: 'msg-2',
      content: 'answer',
      role: 'assistant' as const,
      onFeedback,
    };

    render(<MessageActions {...props} />);

    const positiveButton = screen.getByTitle('도움이 됐어요');
    const negativeButton = screen.getByTitle('개선이 필요해요');

    fireEvent.click(positiveButton);

    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledTimes(1);
      expect(positiveButton).not.toBeDisabled();
      expect(negativeButton).not.toBeDisabled();
    });

    fireEvent.click(negativeButton);

    await waitFor(() => {
      expect(onFeedback).toHaveBeenCalledTimes(2);
    });
  });
});
