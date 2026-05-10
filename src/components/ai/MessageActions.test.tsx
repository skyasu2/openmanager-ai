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

  it('does not render human feedback buttons for assistant messages', () => {
    const props = {
      messageId: 'msg-1',
      content: 'answer',
      role: 'assistant' as const,
    };

    render(<MessageActions {...props} />);

    expect(screen.queryByTitle('도움이 됐어요')).not.toBeInTheDocument();
    expect(screen.queryByTitle('개선이 필요해요')).not.toBeInTheDocument();
  });

  it('keeps copy and regenerate actions available without feedback scoring', async () => {
    const onRegenerate = vi.fn();
    const props = {
      messageId: 'msg-2',
      content: 'answer',
      role: 'assistant' as const,
      onRegenerate,
      showRegenerate: true,
    };

    render(<MessageActions {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '메시지 복사' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('answer');
      expect(screen.getByText('복사됨')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '응답 다시 생성' }));

    expect(onRegenerate).toHaveBeenCalledWith('msg-2');
  });
});
