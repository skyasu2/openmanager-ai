import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import * as path from 'path';

async function main() {
  const envPath = path.join(__dirname, '../.env');
  dotenv.config({ path: envPath });
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim() ?? '';
  const modelId = process.env.GEMINI_VISION_MODEL_ID?.trim() || 'gemini-2.5-flash-lite';

  if (!apiKey) {
    console.error('No GOOGLE_AI_API_KEY found');
    process.exit(1);
  }

  const google = createGoogleGenerativeAI({ apiKey });
  
  console.log('--- Testing Gemini Agent (Vision/Search Role) via API ---');
  console.log(`Model: ${modelId}`);
  console.log('Query: "Linux 서버 메모리 최적화 최신 공식 문서를 찾아줘."');
  
  try {
    const result = await generateText({
      model: google(modelId),
      messages: [{ role: 'user', content: 'Linux 서버 메모리 최적화 최신 공식 문서를 찾아줘. 1~2줄로 짧고 핵심적인 링크 위주로 답변해줘.' }],
      maxOutputTokens: 100,
    });
    console.log();
    console.log('[Gemini Vision Agent Response]');
    console.log(result.text);
    console.log();
    console.log('✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();
