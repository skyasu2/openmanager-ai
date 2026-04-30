import {
  Bell,
  FileSearch,
  LayoutDashboard,
  Network,
  Server,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type DashboardNavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: ComponentType<{ className?: string }>;
};

export const dashboardNavItems: DashboardNavItem[] = [
  {
    label: '개요',
    href: '/dashboard',
    match: (pathname) => pathname === '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '서버',
    href: '/dashboard/servers',
    match: (pathname) => pathname.startsWith('/dashboard/servers'),
    icon: Server,
  },
  {
    label: '알림',
    href: '/dashboard/alerts',
    match: (pathname) => pathname.startsWith('/dashboard/alerts'),
    icon: Bell,
  },
  {
    label: '로그',
    href: '/dashboard/logs',
    match: (pathname) => pathname.startsWith('/dashboard/logs'),
    icon: FileSearch,
  },
  {
    label: '토폴로지',
    href: '/dashboard/topology',
    match: (pathname) => pathname.startsWith('/dashboard/topology'),
    icon: Network,
  },
];
