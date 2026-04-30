'use client';

import { type ComponentType, useEffect, useState } from 'react';
import type { DashboardView } from '@/components/dashboard/types/dashboard-view.types';
import type {
  DashboardDataSourceInfo,
  DashboardStats,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import type { Server } from '@/types/server';
import DashboardLoading from './loading';

type DashboardClientModule = {
  default: ComponentType<{
    dashboardView?: DashboardView;
    initialServers?: Server[];
    initialStats?: DashboardStats;
    initialTimeInfo?: DashboardTimeInfo;
    initialDataSourceInfo?: DashboardDataSourceInfo | null;
    initialFocusServerId?: string | null;
  }>;
};

interface DashboardDevBootstrapProps {
  dashboardView?: DashboardView;
  initialFocusServerId?: string | null;
}

export default function DashboardDevBootstrap({
  dashboardView,
  initialFocusServerId,
}: DashboardDevBootstrapProps) {
  const [DashboardClient, setDashboardClient] = useState<
    DashboardClientModule['default'] | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    void import('./DashboardClient').then((module) => {
      if (isMounted) {
        setDashboardClient(() => module.default);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!DashboardClient) {
    return <DashboardLoading />;
  }

  return (
    <DashboardClient
      dashboardView={dashboardView}
      initialFocusServerId={initialFocusServerId}
    />
  );
}
