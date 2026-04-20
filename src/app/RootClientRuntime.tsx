'use client';

import dynamic from 'next/dynamic';
import { shouldEnableWebVitalsReporter } from '@/app/root-client-runtime-flags';

const EmergencyBanner = dynamic(
  () =>
    import('@/components/emergency/EmergencyBanner').then(
      (mod) => mod.EmergencyBanner
    ),
  { ssr: false, loading: () => null }
);

const SystemBootstrap = dynamic(
  () =>
    import('@/components/system/SystemBootstrap').then(
      (mod) => mod.SystemBootstrap
    ),
  { ssr: false, loading: () => null }
);

const Toaster = dynamic(
  () => import('@/components/ui/toaster').then((mod) => mod.Toaster),
  { ssr: false, loading: () => null }
);

const WebVitalsReporter = shouldEnableWebVitalsReporter()
  ? dynamic(
      () =>
        import('@/components/providers/WebVitalsReporter').then(
          (mod) => mod.WebVitalsReporter
        ),
      { ssr: false, loading: () => null }
    )
  : function DisabledWebVitalsReporter() {
      return null;
    };

export function RootClientRuntime() {
  return (
    <>
      <EmergencyBanner />
      <SystemBootstrap />
      <Toaster />
      <WebVitalsReporter />
    </>
  );
}
