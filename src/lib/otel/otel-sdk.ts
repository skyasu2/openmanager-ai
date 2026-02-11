/**
 * OpenTelemetry SDK Skeleton
 *
 * Disabled by default. Set ENABLE_OPENTELEMETRY=true to activate.
 * When disabled: zero runtime cost (immediate return, no dynamic imports).
 * When enabled: initializes OTel SDK with console exporter for demonstration.
 *
 * This skeleton shows how OTel integration would work in production.
 * Replace ConsoleExporter with OTLPExporter for real observability backends.
 */

const IS_ENABLED = process.env.ENABLE_OPENTELEMETRY === 'true';

/**
 * Initialize OpenTelemetry monitoring.
 * Called from instrumentation.ts during app startup.
 */
export async function initMonitoring(): Promise<void> {
  if (!IS_ENABLED) return;

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { PeriodicExportingMetricReader, ConsoleMetricExporter } =
      await import('@opentelemetry/sdk-metrics');

    const sdk = new NodeSDK({
      serviceName: 'openmanager-vibe',
      metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 60_000,
      }),
    });

    sdk.start();
    console.log('[OTel] SDK initialized (console exporter)');
  } catch (error) {
    console.warn(
      '[OTel] Failed to initialize (dev-only: @opentelemetry/* packages are in devDependencies. Move to dependencies for production use):',
      error
    );
  }
}

// ── No-op instrument stubs ──────────────────────────────────────
// Safe to call even when OTel is disabled — they do nothing.

type NoOpGauge = { record: (value: number) => void };

function createNoOpGauge(): NoOpGauge {
  return { record: () => {} };
}

export const cpuGauge: NoOpGauge = createNoOpGauge();
export const memoryGauge: NoOpGauge = createNoOpGauge();
export const diskGauge: NoOpGauge = createNoOpGauge();
export const networkGauge: NoOpGauge = createNoOpGauge();
