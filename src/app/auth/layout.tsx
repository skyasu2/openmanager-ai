/**
 * Auth Layout - Force Dynamic Rendering for All Auth Routes
 *
 * This layout ensures all /auth/* routes are rendered dynamically
 * to avoid SSR issues with authentication flows, OAuth callbacks,
 * and client-side authentication state
 */

// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

import type { Metadata } from 'next';

// auth/* 경로는 OAuth 플로우 내부 페이지이므로 검색 엔진 색인에서 제외
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
