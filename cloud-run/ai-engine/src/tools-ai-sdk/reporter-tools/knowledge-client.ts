import { getSupabaseConfig } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import type { SupabaseClientLike } from './knowledge-types';

let supabaseInstance: SupabaseClientLike | null = null;

export async function getSupabaseClient(): Promise<SupabaseClientLike | null> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const config = getSupabaseConfig();
  if (!config) {
    logger.warn('⚠️ [Reporter Tools] Supabase config missing');
    return null;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseInstance = createClient(
      config.url,
      config.serviceRoleKey,
    ) as unknown as SupabaseClientLike;
    return supabaseInstance;
  } catch (err) {
    logger.error('⚠️ [Reporter Tools] Supabase client init failed:', err);
    return null;
  }
}
