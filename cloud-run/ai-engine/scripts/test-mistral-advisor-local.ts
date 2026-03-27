// ⚠️ SECURITY WARNING: NEVER hardcode API keys in this script.
// This script reads from the local .env file for testing purposes only.
// Ensure .env is added to .gitignore to prevent accidental leakage.

import { createMistral } from '@ai-sdk/mistral';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import * as path from 'path';

async function main() {
  const envPath = path.join(__dirname, '../.env');
  dotenv.config({ path: envPath });
  const apiKey = process.env.MISTRAL_API_KEY?.trim() ?? '';

  if (!apiKey) {
    console.error('No MISTRAL_API_KEY found');
    process.exit(1);
  }

  const mistral = createMistral({ apiKey });
  
  // 프롬프트를 변수로 분리하여 출력용과 실제 호출용 데이터 일치
  const queryMessage = 'Nginx 서버 메모리 누수 발생 시 어떻게 조치해야 해? 명령어 위주로 1~2줄로 짧고 핵심만 알려줘.';
  const testModel = 'mistral-small-latest'; // Cost Guard: 무료/저비용 한도 최적화를 위한 경량 모델 사용

  console.log('--- Testing Mistral Agent (Advisor Role) via API ---');
  console.log(`Model: ${testModel}`);
  console.log(`Query: "${queryMessage}"`);

  try {
    const result = await generateText({
      model: mistral(testModel),
      messages: [
        {
          role: 'user',
          content: queryMessage,
        },
      ],
      maxOutputTokens: 100, // 원본 코드 유지 (ai SDK 최신 버전 표준)
    });
    
    console.log('\n[Mistral Advisor Agent Response]');
    console.log(result.text);
    console.log('\n✅ Test passed!');
  } catch (error) {
    // 안전한 에러 타입 가드 및 추출
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Test failed:', errorMessage);
  }
}

main();
