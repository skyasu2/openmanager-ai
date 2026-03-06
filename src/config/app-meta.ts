export const APP_NAME = 'OpenManager AI';

// Client-visible version should be consistent across pages. If the public env
// is absent, prefer a neutral placeholder over stale hardcoded values.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
