// Tests that need a browser-like runtime or are intentionally grouped with
// the slower JSDOM suite for local developer ergonomics.
export const domTestGlobs = [
  'src/components/**/*.{test,spec}.{js,ts,tsx}',
  'src/hooks/**/*.{test,spec}.{js,ts,tsx}',
  'tests/ai-sidebar/**/*.{test,spec}.{js,ts,tsx}',
  'src/lib/auth/auth-state-manager.test.ts',
  'src/lib/auth/supabase-auth-oauth.test.ts',
  'src/services/system/SystemInactivityService.test.ts',
  'src/stores/useAISidebarStore.test.ts',
] as const;
