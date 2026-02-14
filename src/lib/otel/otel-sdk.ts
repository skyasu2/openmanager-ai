/**
 * OpenTelemetry SDK Skeleton (프로덕션 모니터링용 아님)
 *
 * 이 SDK는 향후 확장을 위한 스켈레톤 코드입니다.
 * OTel 데이터는 빌드 타임 precompute(`npm run data:otel`)로만 생성/사용됩니다.
 *
 * 런타임 상태:
 * - ENABLE_OPENTELEMETRY 미설정 → 즉시 return (zero overhead)
 * - ENABLE_OPENTELEMETRY=true 설정 시 → ConsoleExporter(stdout)만 동작
 * - OTLP 백엔드 연결 없음, @opentelemetry/* 패키지는 devDependencies
 *
 * 관련 문서: docs/reference/architecture/data/otel-data-architecture.md
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
      serviceName: 'openmanager-ai',
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
