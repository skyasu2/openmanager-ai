/**
 * AI-Ready Code Snippets: Authentication Complete Implementation
 * Usage: Copy-paste for immediate use in OpenManager AI v5
 * Dependencies: @supabase/ssr, @supabase/supabase-js
 */

// ===== 1. Supabase Client Setup =====
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseKey);

// ===== 2. GitHub OAuth Functions =====
export async function signInWithGitHub(callbackUrl?: string) {
  const baseUrl = window.location.origin;
  const redirectTo = callbackUrl
    ? `${baseUrl}${callbackUrl}`
    : `${baseUrl}/auth/callback`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.href = '/login';
}

// ===== 3. Session Management Hook =====
import { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, signInWithGitHub, signOut };
}

// ===== 4. Protected Route Component =====
import { useRouter } from 'next/navigation';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

// ===== 5. Environment Variables Template =====
export const ENV_TEMPLATE = `
# Copy to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key # legacy fallback
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
`;

// ===== 6. Type Definitions =====
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  provider?: string;
}

export interface AuthSession {
  user: AuthUser;
  expires?: string;
}

// ===== 7. Utility Functions =====
export async function getCurrentUser(): Promise<AuthUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email?.split('@')[0],
    avatar_url: user.user_metadata?.avatar_url,
    provider: user.app_metadata?.provider,
  };
}

export async function isAuthenticated(): Promise<boolean> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return !error && !!user;
}
