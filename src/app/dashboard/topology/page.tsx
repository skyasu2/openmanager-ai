import type { Metadata } from 'next';
import { renderDashboardRoute } from '../DashboardRoutePage';

export const metadata: Metadata = {
  title: 'Topology',
  description: 'OpenManager 서버 토폴로지 맵',
};

export default function DashboardTopologyPage() {
  return renderDashboardRoute({ dashboardView: 'topology' });
}
