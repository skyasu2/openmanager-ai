'use client';

/**
 * Dashboard Client Component v5.2.0
 *
 * Receives pre-fetched data from Server Component.
 * Keeps auth/hydration gating in the entry chunk and lazy-loads the
 * heavy interactive dashboard shell after access is confirmed.
 */

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import AuthLoadingUI from '@/components/shared/AuthLoadingUI';
import UnauthorizedAccessUI from '@/components/shared/UnauthorizedAccessUI';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { LOGIN_POLICY_COPY } from '@/lib/auth/login-policy-copy';
import type {
  DashboardDataSourceInfo,
  DashboardStats,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import type { Server } from '@/types/server';
import { envLabel } from '@/utils/vercel-env-utils';
import {
  ContentLoadingSkeleton,
  checkTestMode,
} from './dashboard-client-helpers';

const DashboardInteractiveShell = dynamic(
  () => import('./DashboardInteractiveShell'),
  {
    ssr: false,
    loading: () => <ContentLoadingSkeleton />,
  }
);

/** Props for DashboardClient (Phase 2: SSR data) */
type DashboardClientProps = {
  /** Pre-fetched servers from Server Component */
  initialServers?: Server[];
  /** Pre-calculated stats from Server Component */
  initialStats?: DashboardStats;
  /** Pre-calculated data slot metadata from Server Component */
  initialTimeInfo?: DashboardTimeInfo;
  /** Current synthetic OTel data source metadata from Server Component */
  initialDataSourceInfo?: DashboardDataSourceInfo | null;
  /** Optional serverId query param forwarded from the page */
  initialFocusServerId?: string | null;
};

function DashboardPageContent({
  initialServers,
  initialTimeInfo,
  initialDataSourceInfo,
  initialFocusServerId,
}: DashboardClientProps) {
  const searchParams = useSearchParams();
  const resolvedInitialFocusServerId =
    searchParams.get('serverId') ?? initialFocusServerId ?? null;

  const [isMounted, setIsMounted] = useState(false);
  const [testModeDetected, setTestModeDetected] = useState(() => {
    if (typeof window === 'undefined') return false;
    return checkTestMode();
  });
  const [authLoading, setAuthLoading] = useState(() => {
    if (checkTestMode()) {
      return false;
    }
    return true;
  });

  const router = useRouter();
  const { toast } = useToast();
  const permissions = useUserPermissions();

  useEffect(() => {
    setIsMounted(true);
    const isTestMode = checkTestMode();
    setTestModeDetected((currentMode) =>
      currentMode === isTestMode ? currentMode : isTestMode
    );
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const isGuestFullAccess = isGuestFullAccessEnabled();

    if (isGuestFullAccess) {
      setAuthLoading(false);
      return;
    }

    const canAccess =
      permissions.canAccessDashboard ||
      permissions.isPinAuthenticated ||
      testModeDetected ||
      isGuestFullAccessEnabled();

    if (permissions.userType === 'loading') {
      return;
    }

    if (
      !canAccess &&
      (permissions.userType === 'guest' || permissions.userType === 'github')
    ) {
      setAuthLoading(false);
      toast({
        variant: 'destructive',
        title: '접근 권한 없음',
        description: `대시보드 접근 권한이 없습니다. ${LOGIN_POLICY_COPY.adminPinAuthText} 또는 ${LOGIN_POLICY_COPY.authPrompt}`,
      });
      router.push('/');
      return;
    }

    if (canAccess) {
      setAuthLoading(false);
    }
  }, [isMounted, permissions, router, testModeDetected, toast]);

  const isTestEnvironment = testModeDetected;
  const isGuestFullAccess = isGuestFullAccessEnabled();

  if (
    !isTestEnvironment &&
    isMounted &&
    (authLoading || permissions.userType === 'loading')
  ) {
    return (
      <AuthLoadingUI
        loadingMessage="권한을 확인하고 있습니다"
        envLabel={envLabel}
      />
    );
  }

  if (
    isMounted &&
    !permissions.canAccessDashboard &&
    !permissions.isPinAuthenticated &&
    !testModeDetected &&
    !isGuestFullAccess
  ) {
    return <UnauthorizedAccessUI />;
  }

  return (
    <main
      aria-label="대시보드"
      data-testid="dashboard-container"
      data-test-mode={testModeDetected.toString()}
      data-cookies-present={String(
        typeof document !== 'undefined' &&
          Boolean(document.cookie?.includes('test_mode'))
      )}
      data-hydration-complete={isMounted.toString()}
      data-check-test-mode-result={checkTestMode().toString()}
      className="flex h-dvh bg-gray-100"
    >
      <DashboardInteractiveShell
        initialServers={initialServers}
        initialTimeInfo={initialTimeInfo}
        initialDataSourceInfo={initialDataSourceInfo}
        initialFocusServerId={resolvedInitialFocusServerId}
        isMounted={isMounted}
        canToggleAI={permissions.canToggleAI}
        userType={permissions.userType}
        isGuestFullAccess={isGuestFullAccess}
      />
    </main>
  );
}

export default function DashboardClient(props: DashboardClientProps) {
  return (
    <Suspense fallback={<ContentLoadingSkeleton />}>
      <DashboardPageContent {...props} />
    </Suspense>
  );
}
