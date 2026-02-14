/**
 * Dashboard Page - Server Component with SSR Data Fetching
 *
 * OTel processed 데이터를 직접 소비하여 5단계 변환을 1단계로 축소.
 * - FCP/LCP improvement via server-side data loading
 * - Eliminates client-side waterfall
 *
 * NOTE: Dynamic rendering is configured in layout.tsx
 */

import { getOTelDashboardData } from '@/lib/dashboard/server-data';
import type { Server } from '@/types/server';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const { servers, stats, timeInfo } = await getOTelDashboardData();

  return (
    <DashboardClient
      initialServers={servers as unknown as Server[]}
      initialStats={stats}
      timeInfo={timeInfo}
    />
  );
}
