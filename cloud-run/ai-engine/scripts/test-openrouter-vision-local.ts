// ⚠️ SECURITY WARNING: NEVER hardcode API keys in this script.
// This script reads from the local .env file and uses Google Gemma-3-4b-it.

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

async function main() {
  const envPath = path.join(__dirname, '../.env');
  dotenv.config({ path: envPath });

  const apiKey = process.env.OPENROUTER_API_KEY?.replace(/^"|"$/g, '');
  if (!apiKey) {
    console.error('No OPENROUTER_API_KEY found');
    process.exit(1);
  }

  const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });
  
  console.log('--- Testing OpenRouter Vision (Gemma-3-4b-it) via API ---');
  const modelId = 'google/gemma-3-4b-it:free';
  console.log(`Using model: ${modelId}`);
  
  const projectRoot = path.join(__dirname, '../../../');
  const imagePath = path.join(projectRoot, 'public/dashboard-icon.png');
  
  if (!fs.existsSync(imagePath)) {
    console.error('Sample image not found');
    process.exit(1);
  }

  const imageData = fs.readFileSync(imagePath).toString('base64');
  const dataUrl = `data:image/png;base64,${imageData}`;

  try {
    const result = await generateText({
      model: openrouter(modelId),
      messages: [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: '이 이미지에 무엇이 보이는지 한국어로 1줄로 요약해줘.' },
            { type: 'image', image: dataUrl }
          ] 
        }
      ] as any,
      maxOutputTokens: 100,
    });

    console.log('\n[OpenRouter Vision Response]');
    console.log(result.text || '(Empty response)');
    console.log('\n✅ OpenRouter test finished!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

main();
