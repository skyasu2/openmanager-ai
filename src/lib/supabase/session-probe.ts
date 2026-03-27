import type { SupabaseClient } from '@supabase/supabase-js';
import { getErrorMessage } from '@/types/type-utils';

const SESSION_ERROR_HINTS = ['session', 'expired', 'not found'];

export const SUPABASE_SESSION_PROBE_TIMEOUT_MS = 3000;

export interface SupabaseSessionProbeOptions {
  timeoutMs?: number;
  timeoutMessage?: string;
}

export interface SupabaseSessionProbeResult {
  reachable: boolean;
  timedOut: boolean;
  errorMessage?: string;
}

interface SupabaseSessionResponse {
  error: { message: string } | null;
}

export function isIgnorableSupabaseSessionErrorMessage(
  message: string
): boolean {
  const normalizedMessage = message.toLowerCase();
  return SESSION_ERROR_HINTS.some((hint) => normalizedMessage.includes(hint));
}

export async function probeSupabaseSession(
  supabase: Pick<SupabaseClient, 'auth'>,
  options: SupabaseSessionProbeOptions = {}
): Promise<SupabaseSessionProbeResult> {
  const timeoutMs = options.timeoutMs ?? SUPABASE_SESSION_PROBE_TIMEOUT_MS;
  const timeoutMessage =
    options.timeoutMessage ??
    `Supabase session probe timed out after ${timeoutMs}ms`;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    const { error } = (await Promise.race([
      supabase.auth.getSession(),
      timeoutPromise,
    ])) as SupabaseSessionResponse;

    if (error && !isIgnorableSupabaseSessionErrorMessage(error.message)) {
      return {
        reachable: false,
        timedOut: false,
        errorMessage: error.message,
      };
    }

    return { reachable: true, timedOut: false };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    return {
      reachable: false,
      timedOut: errorMessage === timeoutMessage,
      errorMessage,
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
