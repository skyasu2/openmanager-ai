/**
 * 🔐 Supabase Server Client (SSR)
 *
 * For use in Server Components and Server Actions.
 */

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies } from 'next/headers';
import {
  getSupabaseServerPublishableKey,
  getSupabaseServerUrl,
} from './env';

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const supabaseUrl = getSupabaseServerUrl();
  const supabaseKey = getSupabaseServerPublishableKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: Partial<ResponseCookie>;
        }>
      ) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  }) as SupabaseClient;
}
