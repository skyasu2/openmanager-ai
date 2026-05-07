const LOCAL_ANALYSIS_ENABLED = process.env.SENTRY_LOCAL_ANALYSIS === 'true';
const IS_VERCEL_PRODUCTION = process.env.VERCEL_ENV === 'production';

export function isLocalSentryServerEnabled(): boolean {
  return (
    LOCAL_ANALYSIS_ENABLED &&
    !IS_VERCEL_PRODUCTION &&
    Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  );
}

export function getLocalSentryDsn(): string | undefined {
  if (!isLocalSentryServerEnabled()) return undefined;
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
}

export function captureLocalSentryException(
  error: unknown,
  configure?: (scope: import('@sentry/nextjs').Scope) => void
): void {
  if (!isLocalSentryServerEnabled()) return;

  void import('@sentry/nextjs').then(({ default: Sentry }) => {
    if (configure) {
      Sentry.withScope((scope) => {
        configure(scope);
        Sentry.captureException(error);
      });
      return;
    }

    Sentry.captureException(error);
  });
}
