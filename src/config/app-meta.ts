const APP_NAME = 'OpenManager AI';

// Client-visible version should be consistent across pages. If the public env
// is absent, prefer a neutral placeholder over stale hardcoded values.
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
export const TECH_STACK_DISPLAY = 'Next.js 16 + React 19';
export const AI_PROVIDER_DISPLAY = 'Provider Mesh AI';
