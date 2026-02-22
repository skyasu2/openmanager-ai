/**
 * 🔐 Supabase Auth Provider
 *
 * Supabase 기반 OAuth 세션 관리를 위한 Provider 컴포넌트
 */

'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { authStateManager } from '@/lib/auth/auth-state-manager';
import { logger } from '@/lib/logging';
import { getSupabase } from '@/lib/supabase/client';

interface SupabaseAuthProviderProps {
  children: ReactNode;
}

export default function SupabaseAuthProvider({
  children,
}: SupabaseAuthProviderProps) {
  useEffect(() => {
    const { data: authListener } = getSupabase().auth.onAuthStateChange(
      (_event, session) => {
        authStateManager.invalidateCache();
        logger.info(
          '🔐 Auth state changed:',
          session ? 'Authenticated' : 'Not authenticated'
        );
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
