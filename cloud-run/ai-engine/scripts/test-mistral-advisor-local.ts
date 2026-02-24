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

  console.log('--- Testing Mistral Agent (Advisor Role) via API ---');
  console.log('Model: mistral-large-latest');
  console.log(
    'Query: "Nginx 서버 메모리 누수 발생 시 어떻게 조치해야 해? 명령어 위주로 알려줘."'
  );

  try {
    const result = await generateText({
      model: mistral('mistral-large-latest'),
      messages: [
        {
          role: 'user',
          content:
            'Nginx 서버 메모리 누수 발생 시 어떻게 조치해야 해? 명령어 위주로 1~2줄로 짧고 핵심만 알려줘.',
        },
      ],
      maxOutputTokens: 100,
    });
    console.log('\n[Mistral Advisor Agent Response]');
    console.log(result.text);
    console.log('\n✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();
