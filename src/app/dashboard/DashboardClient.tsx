'use client';

import dynamic from 'next/dynamic';
import type {
  DashboardDataSourceInfo,
  DashboardStats,
  DashboardTimeInfo,
} from '@/lib/dashboard/server-data';
import type { Server } from '@/types/server';
import { ContentLoadingSkeleton } from './dashboard-client-helpers';

type DashboardClientProps = {
  initialServers?: Server[];
  initialStats?: DashboardStats;
  initialTimeInfo?: DashboardTimeInfo;
  initialDataSourceInfo?: DashboardDataSourceInfo | null;
  initialFocusServerId?: string | null;
};

const DashboardClientRuntime = dynamic(
  () => import('./DashboardClientRuntime'),
  {
    ssr: false,
    loading: () => <ContentLoadingSkeleton />,
  }
);

export default function DashboardClient(props: DashboardClientProps) {
  return <DashboardClientRuntime {...props} />;
}
