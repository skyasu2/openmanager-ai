/**
 * Next.js Instrumentation (Next.js 16 권장 방식)
 *
 * 앱 시작 시 실행되는 초기화 코드
 * - 환경변수 검증
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // dev 모드에서는 startup instrumentation을 완전히 건너뜀.
  // env 파싱도 root cold compile 경로에 포함되므로 local dev startup에는 비용만 추가한다.
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // ── Production only ──────────────────────────────────────────────────────

  // Node.js 런타임 (Server)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 환경변수 검증
    try {
      await import('./src/env');
      console.log('✅ 환경변수 검증 완료');
    } catch (error) {
      console.error('🚨 환경변수 검증 실패:', error);
      process.exit(1);
    }

    // 선택적 환경변수 검증
    try {
      const { validateEnvironmentVariables } = await import(
        './src/lib/config/env-validation'
      );
      validateEnvironmentVariables();
    } catch (error) {
      console.error('⚠️ 선택적 환경변수 검증 실패:', error);
      process.exit(1);
    }

    // OpenTelemetry (ENABLE_OPENTELEMETRY=true 시 활성화)
    try {
      const { initMonitoring } = await import('./src/lib/otel/otel-sdk');
      await initMonitoring();
    } catch (error) {
      console.warn('⚠️ OTel module load failed (non-fatal):', error);
    }
  }
}
