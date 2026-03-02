import type { Preview } from '@storybook/nextjs-vite';
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

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
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
