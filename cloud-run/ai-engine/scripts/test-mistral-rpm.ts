/**
 * Mistral Free Tier RPM 실측 테스트
 *
 * 목적: Mistral API Free Tier의 실제 분당 요청 한도(RPM) 측정
 * 방법: 1초 간격으로 embedding 요청을 보내면서 429 Rate Limit 시점 기록
 *
 * 실행: cd cloud-run/ai-engine && npx tsx scripts/test-mistral-rpm.ts
 */

import { createMistral } from '@ai-sdk/mistral';
import { embed } from 'ai';

// ============================================================================
// Configuration
// ============================================================================

const MAX_REQUESTS = 60; // 최대 테스트 요청 수
const INTERVAL_MS = 0; // 요청 간격 (0 = 대기 없이 연속)
const TEST_TEXT = 'Server CPU utilization is at 85% with memory at 72%.';

// ============================================================================
// Main
// ============================================================================

async function main() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('❌ MISTRAL_API_KEY 환경변수가 설정되지 않았습니다.');
    console.error('   실행: MISTRAL_API_KEY=your-key npx tsx scripts/test-mistral-rpm.ts');
    process.exit(1);
  }

  const mistral = createMistral({ apiKey });
  const model = mistral.embedding('mistral-embed');

  console.log('🧪 Mistral Free Tier RPM 실측 테스트');
  console.log(`   모델: mistral-embed`);
  console.log(`   최대 요청: ${MAX_REQUESTS}회`);
  console.log(`   간격: ${INTERVAL_MS}ms`);
  console.log(`   텍스트: "${TEST_TEXT.substring(0, 50)}..."`);
  console.log('─'.repeat(60));

  const results: Array<{
    index: number;
    timestamp: number;
    elapsed: string;
    status: 'ok' | 'rate-limited' | 'error';
    latencyMs: number;
    error?: string;
  }> = [];

  const testStart = Date.now();
  let rateLimitHit = false;
  let successCount = 0;
  let rateLimitCount = 0;

  for (let i = 1; i <= MAX_REQUESTS; i++) {
    const reqStart = Date.now();
    const elapsed = ((reqStart - testStart) / 1000).toFixed(1);

    try {
      const { embedding } = await embed({
        model,
        value: `${TEST_TEXT} [req-${i}]`,
        experimental_telemetry: { isEnabled: false },
      });

      const latencyMs = Date.now() - reqStart;
      successCount++;

      const entry = {
        index: i,
        timestamp: reqStart,
        elapsed: `${elapsed}s`,
        status: 'ok' as const,
        latencyMs,
      };
      results.push(entry);

      console.log(
        `  ✅ #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | dim=${embedding.length} | 누적 성공: ${successCount}`
      );
    } catch (error) {
      const latencyMs = Date.now() - reqStart;
      const message = error instanceof Error ? error.message : String(error);
      const is429 = message.includes('429') || message.toLowerCase().includes('rate limit');

      if (is429) {
        rateLimitCount++;
        if (!rateLimitHit) {
          rateLimitHit = true;
          console.log(
            `  🚫 #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | ⚡ RATE LIMIT (429) — 첫 발생!`
          );
        } else {
          console.log(
            `  🚫 #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | 429 반복 (${rateLimitCount}회)`
          );
        }
      } else {
        console.log(
          `  ❌ #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | ERROR: ${message.substring(0, 80)}`
        );
      }

      results.push({
        index: i,
        timestamp: reqStart,
        elapsed: `${elapsed}s`,
        status: is429 ? 'rate-limited' : 'error',
        latencyMs,
        error: message.substring(0, 200),
      });

      // Rate limit 후 5회 더 시도하여 패턴 확인
      if (rateLimitCount >= 5) {
        console.log(`\n  ⏹️  Rate limit 5회 반복 — 테스트 종료`);
        break;
      }
    }

    // 다음 요청 대기
    if (i < MAX_REQUESTS) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  // ============================================================================
  // Summary
  // ============================================================================

  const totalDuration = ((Date.now() - testStart) / 1000).toFixed(1);
  const firstRateLimit = results.find((r) => r.status === 'rate-limited');
  const avgLatency =
    results.filter((r) => r.status === 'ok').length > 0
      ? Math.round(
          results
            .filter((r) => r.status === 'ok')
            .reduce((sum, r) => sum + r.latencyMs, 0) /
            results.filter((r) => r.status === 'ok').length
        )
      : 0;

  console.log('\n' + '═'.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('═'.repeat(60));
  console.log(`  총 요청:        ${results.length}회`);
  console.log(`  성공:           ${successCount}회`);
  console.log(`  Rate Limit:     ${rateLimitCount}회`);
  console.log(`  기타 에러:      ${results.filter((r) => r.status === 'error').length}회`);
  console.log(`  총 소요 시간:   ${totalDuration}s`);
  console.log(`  평균 응답 시간: ${avgLatency}ms`);

  if (firstRateLimit) {
    console.log(`\n  ⚡ 첫 Rate Limit 발생: 요청 #${firstRateLimit.index} (${firstRateLimit.elapsed})`);
    console.log(`  → 실측 RPM ≈ ${firstRateLimit.index - 1}회/분 (${firstRateLimit.index - 1} successful before 429)`);
  } else {
    console.log(`\n  ✅ ${MAX_REQUESTS}회 모두 성공 — RPM 한도 > ${MAX_REQUESTS}`);
  }

  console.log('═'.repeat(60));
}

main().catch(console.error);
