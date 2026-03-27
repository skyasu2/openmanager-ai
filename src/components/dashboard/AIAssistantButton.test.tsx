/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistantButton } from './AIAssistantButton';

void React;

describe('AIAssistantButton', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and displays button text', () => {
    render(
      <AIAssistantButton
        isOpen={false}
        isEnabled={false}
        onClick={mockOnClick}
      />
    );
    expect(screen.getByRole('button')).toBeDefined();
    expect(screen.getByText('AI 어시스턴트')).toBeDefined();
  });

  it('calls onClick handler when clicked', () => {
    render(
      <AIAssistantButton
        isOpen={false}
        isEnabled={false}
        onClick={mockOnClick}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('updates aria attributes and style when isOpen is true', async () => {
    render(
      <AIAssistantButton
        isOpen={true}
        isEnabled={false}
        onClick={mockOnClick}
      />
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button.getAttribute('aria-label')).toBe('AI 어시스턴트 닫기');
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(button.style.background).toBeTruthy();
    });
  });

  it('shows active indicator when isEnabled is true', async () => {
    const { container } = render(
      <AIAssistantButton
        isOpen={false}
        isEnabled={true}
        onClick={mockOnClick}
      />
    );

    await waitFor(() => {
      const indicator = container.querySelector('.bg-green-400');
      expect(indicator).toBeDefined();
    });
  });
});
