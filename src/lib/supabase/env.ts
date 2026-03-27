function getTrimmedEnvValue(name: string): string {
  return process.env[name]?.trim() || '';
}

function getFirstDefinedEnvValue(names: string[]): string {
  for (const name of names) {
    const value = getTrimmedEnvValue(name);
    if (value) return value;
  }

  return '';
}

export function getSupabasePublicUrl(): string {
  return getFirstDefinedEnvValue(['NEXT_PUBLIC_SUPABASE_URL']);
}

export function getSupabasePublicPublishableKey(): string {
  return getFirstDefinedEnvValue([
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);
}

export function getSupabaseServerUrl(): string {
  return getFirstDefinedEnvValue(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
}

export function getSupabaseServerPublishableKey(): string {
  return getFirstDefinedEnvValue([
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]);
}
