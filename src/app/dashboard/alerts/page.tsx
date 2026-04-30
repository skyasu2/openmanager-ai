import type { Metadata } from 'next';
import { renderDashboardRoute } from '../DashboardRoutePage';

export const metadata: Metadata = {
  title: 'Alerts',
  description: 'OpenManager 활성 알림과 알림 이력',
};

export default function DashboardAlertsPage() {
  return renderDashboardRoute({ dashboardView: 'alerts' });
}
