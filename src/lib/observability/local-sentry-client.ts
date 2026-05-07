'use client';

type CaptureOptions = {
  tags?: Record<string, string | undefined>;
};

export function captureLocalSentryException(
  error: unknown,
  options: CaptureOptions = {}
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_LOCAL_ANALYSIS !== 'true') {
    return;
  }

  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureException(error, {
      tags: options.tags,
    });
  });
}
