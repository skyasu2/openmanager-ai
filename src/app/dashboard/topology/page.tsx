import type { Metadata } from 'next';
import { renderDashboardRoute } from '../DashboardRoutePage';

export const metadata: Metadata = {
  title: 'Infrastructure Map',
  description: 'OpenManager 서버 상태와 의존성 통합 인프라 맵',
};

export default function DashboardTopologyPage() {
  return renderDashboardRoute({ dashboardView: 'topology' });
}
