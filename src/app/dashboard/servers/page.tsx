import type { Metadata } from 'next';
import { renderDashboardRoute } from '../DashboardRoutePage';

export const metadata: Metadata = {
  title: 'Servers',
  description: 'OpenManager 서버 목록과 상태 필터',
};

export default function DashboardServersPage() {
  return renderDashboardRoute({ dashboardView: 'servers' });
}
