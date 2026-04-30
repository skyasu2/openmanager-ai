import type { Metadata } from 'next';
import { renderDashboardRoute } from '../DashboardRoutePage';

export const metadata: Metadata = {
  title: 'Logs',
  description: 'OpenManager 24시간 OTel 로그 탐색기',
};

export default function DashboardLogsPage() {
  return renderDashboardRoute({ dashboardView: 'logs' });
}
