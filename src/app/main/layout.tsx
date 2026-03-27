/**
 * Main Page Layout - Force Dynamic Rendering
 *
 * This layout ensures the entire /main route is rendered dynamically
 * to avoid SSR issues with client-side authentication hooks
 */

// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
