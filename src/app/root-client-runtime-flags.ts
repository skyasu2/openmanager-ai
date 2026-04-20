export function shouldEnableWebVitalsReporter(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return process.env.NEXT_PUBLIC_ENABLE_WEB_VITALS === 'true';
}
