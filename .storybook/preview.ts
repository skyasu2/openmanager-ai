import type { Preview } from '@storybook/nextjs-vite';
import { sb } from 'storybook/test';
import '../src/styles/globals.css';

// ─── Page-level story module mocks ─────────────────────────
// NOTE: .ts extension is REQUIRED for extractMockCalls (uses require.resolve)
// Stores
sb.mock(import('../src/stores/useUnifiedAdminStore.ts'));
sb.mock(import('../src/stores/useAISidebarStore.ts'));
// Auth
sb.mock(import('../src/lib/supabase/client.ts'));
sb.mock(import('../src/lib/auth/supabase-auth-oauth.ts'));
sb.mock(import('../src/lib/auth/auth-state-manager.ts'));
// Hooks
sb.mock(import('../src/hooks/useUserPermissions.ts'));
sb.mock(import('../src/hooks/useServerDashboard.ts'));
sb.mock(import('../src/hooks/useAutoLogout.ts'));
sb.mock(import('../src/hooks/useSystemAutoShutdown.ts'));
sb.mock(import('../src/hooks/use-toast.ts'));
sb.mock(import('../src/hooks/ai/useAIChatCore.ts'));
sb.mock(import('../src/hooks/ai/utils/chat-history-storage.ts'));
// Sub-component transitive dependencies
sb.mock(import('../src/components/unified-profile/hooks/useProfileAuth.ts'));
sb.mock(import('../src/components/unified-profile/hooks/useProfileMenu.ts'));
sb.mock(import('../src/hooks/useSystemStatus.ts'));
sb.mock(import('../src/hooks/useSupabaseSession.ts'));
// Config & Utils
sb.mock(import('../src/config/guestMode.ts'));
sb.mock(import('../src/utils/ai-warmup.ts'));
// Services
sb.mock(import('../src/services/system/SystemInactivityService.ts'));

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
