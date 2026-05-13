import { useEffect } from 'react';
import { AI_ASSISTANT_LIGHT_THEME_TOKENS } from './AIWorkspace.constants';

export function useAIAssistantLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previousTokens = new Map<string, string>();
    const previousColorScheme = root.style.colorScheme;

    for (const [token, value] of Object.entries(
      AI_ASSISTANT_LIGHT_THEME_TOKENS
    )) {
      previousTokens.set(token, root.style.getPropertyValue(token));
      root.style.setProperty(token, value);
    }
    root.style.colorScheme = 'light';

    return () => {
      for (const [token, previousValue] of previousTokens) {
        if (previousValue) {
          root.style.setProperty(token, previousValue);
        } else {
          root.style.removeProperty(token);
        }
      }
      root.style.colorScheme = previousColorScheme;
    };
  }, []);
}
