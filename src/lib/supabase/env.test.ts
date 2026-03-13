import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('supabase env helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadHelpers(): Promise<typeof import('./env')> {
    return import('./env');
  }

  it('reads public URL from NEXT_PUBLIC_SUPABASE_URL', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_URL',
      ' https://public.example.supabase.co '
    );

    const { getSupabasePublicUrl } = await loadHelpers();

    expect(getSupabasePublicUrl()).toBe('https://public.example.supabase.co');
  });

  it('uses publishable key before anon key for public clients', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', ' publishable-key ');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ' anon-key ');

    const { getSupabasePublicPublishableKey } = await loadHelpers();

    expect(getSupabasePublicPublishableKey()).toBe('publishable-key');
  });

  it('falls back to server URL when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_URL', ' https://server.example.supabase.co ');

    const { getSupabaseServerUrl } = await loadHelpers();

    expect(getSupabaseServerUrl()).toBe('https://server.example.supabase.co');
  });

  it('falls back to SUPABASE_ANON_KEY for server runtime paths', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_ANON_KEY', ' server-anon-key ');

    const { getSupabaseServerPublishableKey } = await loadHelpers();

    expect(getSupabaseServerPublishableKey()).toBe('server-anon-key');
  });

  it('returns empty string when no matching env exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_ANON_KEY', '');

    const {
      getSupabasePublicUrl,
      getSupabasePublicPublishableKey,
      getSupabaseServerUrl,
      getSupabaseServerPublishableKey,
    } = await loadHelpers();

    expect(getSupabasePublicUrl()).toBe('');
    expect(getSupabasePublicPublishableKey()).toBe('');
    expect(getSupabaseServerUrl()).toBe('');
    expect(getSupabaseServerPublishableKey()).toBe('');
  });
});
