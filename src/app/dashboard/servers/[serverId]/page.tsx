import type { Metadata } from 'next';
import { renderDashboardRoute } from '../../DashboardRoutePage';

type DashboardServerDetailPageProps = {
  params: Promise<{
    serverId: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Server Detail',
  description: 'OpenManager 서버 상세 메트릭과 로그',
};

export default async function DashboardServerDetailPage({
  params,
}: DashboardServerDetailPageProps) {
  const { serverId } = await params;

  return renderDashboardRoute({
    dashboardView: 'server-detail',
    initialFocusServerId: decodeURIComponent(serverId),
  });
}
