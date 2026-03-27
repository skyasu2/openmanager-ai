/**
 * Dashboard Layout - Force Dynamic Rendering
 *
 * This layout ensures the entire /dashboard route is rendered dynamically
 * to avoid SSR issues with client-side hooks and authentication
 */

// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
