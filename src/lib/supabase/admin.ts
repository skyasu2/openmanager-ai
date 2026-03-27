/**
 * 🔐 Supabase Admin Client (Server-Only)
 *
 * Uses the SERVICE_ROLE_KEY to bypass RLS.
 * NEVER import this in client-side code.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging';
import { getSupabaseServerUrl } from './env';

if (typeof window !== 'undefined') {
  throw new Error('supabase/admin.ts should only be imported on the server.');
}

const supabaseUrl = getSupabaseServerUrl();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // Allow build to pass if env vars are missing (e.g. CI)
  if (process.env.NODE_ENV !== 'production') {
    logger.warn('Missing Supabase Admin keys, using placeholders');
  }
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
