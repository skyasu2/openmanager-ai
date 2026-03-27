/**
 * Mistral Free Tier RPM 실측 테스트 — Chat (LLM) 엔드포인트
 *
 * Embedding은 RPM 제한 없이 동작했으므로,
 * Chat (generateText) 엔드포인트의 실제 RPM 한도를 측정합니다.
 *
 * 실행: cd cloud-run/ai-engine && npx tsx scripts/test-mistral-rpm-chat.ts
 */

import { createMistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';

// ============================================================================
// Configuration
// ============================================================================

const MAX_REQUESTS = 15; // Chat은 더 느리므로 15회
const INTERVAL_MS = 0; // 대기 없이 연속
const SYSTEM_PROMPT = 'Reply in exactly one short sentence.';
const USER_PROMPT = 'What is CPU utilization?';

// ============================================================================
// Main
// ============================================================================

async function main() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('❌ MISTRAL_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const mistral = createMistral({ apiKey });

  console.log('🧪 Mistral Free Tier RPM 실측 — Chat (LLM) 테스트');
  console.log(`   모델: mistral-small-latest`);
  console.log(`   최대 요청: ${MAX_REQUESTS}회`);
  console.log(`   간격: ${INTERVAL_MS}ms (burst)`);
  console.log('─'.repeat(60));

  const testStart = Date.now();
  let successCount = 0;
  let rateLimitCount = 0;

  for (let i = 1; i <= MAX_REQUESTS; i++) {
    const reqStart = Date.now();
    const elapsed = ((reqStart - testStart) / 1000).toFixed(1);

    try {
      const result = await generateText({
        model: mistral('mistral-small-latest'),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${USER_PROMPT} [${i}]` },
        ],
        maxOutputTokens: 50,
        temperature: 0.1,
        maxRetries: 0, // 재시도 없이 raw 에러 확인
      });

      const latencyMs = Date.now() - reqStart;
      successCount++;

      const text = result.text.substring(0, 60).replace(/\n/g, ' ');
      console.log(
        `  ✅ #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | "${text}..." | 누적: ${successCount}`
      );
    } catch (error) {
      const latencyMs = Date.now() - reqStart;
      const message = error instanceof Error ? error.message : String(error);
      const is429 = message.includes('429') || message.toLowerCase().includes('rate limit') || message.includes('Too many requests');

      if (is429) {
        rateLimitCount++;
        console.log(
          `  🚫 #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | ⚡ RATE LIMIT (429) — 횟수: ${rateLimitCount}`
        );
      } else {
        console.log(
          `  ❌ #${String(i).padStart(2, '0')} | ${elapsed}s | ${latencyMs}ms | ${message.substring(0, 100)}`
        );
      }

      if (rateLimitCount >= 5) {
        console.log(`\n  ⏹️  Rate limit 5회 반복 — 테스트 종료`);
        break;
      }
    }

    if (i < MAX_REQUESTS && INTERVAL_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
  }

  // Summary
  const totalDuration = ((Date.now() - testStart) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Chat (LLM) RPM 테스트 결과');
  console.log('═'.repeat(60));
  console.log(`  총 요청:        ${successCount + rateLimitCount}회`);
  console.log(`  성공:           ${successCount}회`);
  console.log(`  Rate Limit:     ${rateLimitCount}회`);
  console.log(`  총 소요 시간:   ${totalDuration}s`);

  if (rateLimitCount > 0) {
    console.log(`  → Chat RPM 실측 ≈ ${successCount}회/분 이내`);
  } else {
    console.log(`  ✅ ${MAX_REQUESTS}회 모두 성공 — Chat RPM > ${MAX_REQUESTS}`);
  }
  console.log('═'.repeat(60));
}

main().catch(console.error);
