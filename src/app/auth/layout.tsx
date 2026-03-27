/**
 * Auth Layout - Force Dynamic Rendering for All Auth Routes
 *
 * This layout ensures all /auth/* routes are rendered dynamically
 * to avoid SSR issues with authentication flows, OAuth callbacks,
 * and client-side authentication state
 */

// MIGRATED: Removed export const dynamic = "force-dynamic" (now default)

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
