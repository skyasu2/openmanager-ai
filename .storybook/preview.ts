import type { Decorator, Preview } from '@storybook/react-vite';
import { sb } from 'storybook/test';

import '../src/styles/globals.css';

// ─── Global Module Mocks ────────────────────────────────────
// sb.mock() must be registered here (preview.ts), not in story files.
// Individual stories configure mock behavior via mocked() in beforeEach.

// Stores
sb.mock(import('../src/stores/useUnifiedAdminStore.ts'));
sb.mock(import('../src/stores/useAISidebarStore.ts'));

// Hooks — AI
sb.mock(import('../src/hooks/ai/useAIChatCore.ts'));

// Hooks — System
sb.mock(import('../src/hooks/system/useHealthCheck.ts'));
sb.mock(import('../src/hooks/useSystemStatus.ts'));
sb.mock(import('../src/hooks/useSystemAutoShutdown.ts'));
sb.mock(import('../src/hooks/useAutoLogout.ts'));

// Hooks — Dashboard
sb.mock(import('../src/hooks/useServerDashboard.ts'));
sb.mock(import('../src/hooks/useServerMetrics.ts'));
sb.mock(import('../src/hooks/useUserPermissions.ts'));
sb.mock(import('../src/hooks/dashboard/useMonitoringReport.ts'));
sb.mock(import('../src/hooks/use-toast.ts'));

// Hooks — Profile
sb.mock(import('../src/components/unified-profile/hooks/useProfileAuth.ts'));
sb.mock(import('../src/components/unified-profile/hooks/useProfileMenu.ts'));

// Auth
sb.mock(import('../src/lib/auth/auth-state-manager.ts'));
sb.mock(import('../src/lib/auth/supabase-auth-oauth.ts'));

// Config & Services
sb.mock(import('../src/config/guestMode.ts'));
sb.mock(import('../src/services/system/SystemInactivityService.ts'));

// ─── Preview Config ─────────────────────────────────────────

type NextjsNavigationParam = {
  pathname?: string;
  query?: Record<string, string | string[]>;
  segments?: Array<string | [string, string]>;
};

type NextjsParameter = {
  appDirectory?: boolean;
  navigation?: NextjsNavigationParam;
};

declare global {
  // eslint-disable-next-line no-var
  var __STORYBOOK_NEXT_NAVIGATION__: {
    pathname: string;
    queryEntries: Array<[string, string]>;
    segments: Array<string | [string, string]>;
  };
}

function toQueryEntries(
  query: Record<string, string | string[]> | undefined
): Array<[string, string]> {
  if (!query) return [];

  const entries: Array<[string, string]> = [];
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        entries.push([key, item]);
      });
      return;
    }
    entries.push([key, value]);
  });

  return entries;
}

const withNextjsNavigationParameters: Decorator = (Story, context) => {
  const nextjs = context.parameters?.nextjs as NextjsParameter | undefined;
  const navigation = nextjs?.navigation ?? {};

  globalThis.__STORYBOOK_NEXT_NAVIGATION__ = {
    pathname: navigation.pathname ?? '/',
    queryEntries: toQueryEntries(navigation.query),
    segments: navigation.segments ?? [],
  };

  return Story();
};

const preview: Preview = {
  decorators: [withNextjsNavigationParameters],
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0a0a1a' },
        { name: 'light', value: '#ffffff' },
        { name: 'gray', value: '#f5f5f5' },
      ],
    },
  },
};

export default preview;
