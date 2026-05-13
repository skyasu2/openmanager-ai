import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AI_ASSISTANT_LIGHT_THEME_TOKENS } from './AIWorkspace.constants';
import { useAIAssistantLightTheme } from './useAIAssistantLightTheme';

describe('useAIAssistantLightTheme', () => {
  const root = document.documentElement;

  beforeEach(() => {
    root.style.setProperty('--background', '10 20% 30%');
    root.style.removeProperty('--foreground');
    root.style.colorScheme = 'dark';
  });

  afterEach(() => {
    for (const token of Object.keys(AI_ASSISTANT_LIGHT_THEME_TOKENS)) {
      root.style.removeProperty(token);
    }
    root.style.colorScheme = '';
  });

  it('applies light tokens and restores previous root styles on unmount', () => {
    const { unmount } = renderHook(() => useAIAssistantLightTheme());

    expect(root.style.getPropertyValue('--background')).toBe(
      AI_ASSISTANT_LIGHT_THEME_TOKENS['--background']
    );
    expect(root.style.getPropertyValue('--foreground')).toBe(
      AI_ASSISTANT_LIGHT_THEME_TOKENS['--foreground']
    );
    expect(root.style.colorScheme).toBe('light');

    unmount();

    expect(root.style.getPropertyValue('--background')).toBe('10 20% 30%');
    expect(root.style.getPropertyValue('--foreground')).toBe('');
    expect(root.style.colorScheme).toBe('dark');
  });
});
