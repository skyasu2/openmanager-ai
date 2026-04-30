import dynamic from 'next/dynamic';
import { connection } from 'next/server';
import type { DashboardView } from '@/components/dashboard/types/dashboard-view.types';
import DashboardDevBootstrap from './DashboardDevBootstrap';
import DashboardLoading from './loading';

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  loading: () => <DashboardLoading />,
  ssr: process.env.NODE_ENV !== 'development',
});

interface RenderDashboardRouteOptions {
  dashboardView: DashboardView;
  initialFocusServerId?: string | null;
}

export async function renderDashboardRoute({
  dashboardView,
  initialFocusServerId = null,
}: RenderDashboardRouteOptions) {
  if (process.env.NODE_ENV === 'development') {
    return (
      <DashboardDevBootstrap
        dashboardView={dashboardView}
        initialFocusServerId={initialFocusServerId}
      />
    );
  }

  await connection();
  const { getOTelDashboardData } = await import('@/lib/dashboard/server-data');
  const { servers, stats, timeInfo, dataSourceInfo } =
    await getOTelDashboardData();

  return (
    <DashboardClient
      dashboardView={dashboardView}
      initialServers={servers}
      initialStats={stats}
      initialTimeInfo={timeInfo}
      initialDataSourceInfo={dataSourceInfo}
      initialFocusServerId={initialFocusServerId}
    />
  );
}
