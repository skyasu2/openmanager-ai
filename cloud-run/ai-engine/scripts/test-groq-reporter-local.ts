import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import dotenv from 'dotenv';
import * as path from 'path';

async function main() {
  const envPath = path.join(__dirname, '../.env');
  dotenv.config({ path: envPath });
  const apiKey = process.env.GROQ_API_KEY?.trim() ?? '';

  if (!apiKey) {
    console.error('No GROQ_API_KEY found');
    process.exit(1);
  }

  const groq = createGroq({ apiKey });
  
  console.log('--- Testing Groq Agent (Reporter Role) via API ---');
  console.log('Model: llama-3.3-70b-versatile');
  console.log('Query: "현재 시스템 장애 보고서를 작성해줘. 짧고 명확하게."');
  
  try {
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      messages: [{ role: 'user', content: '현재 시스템 장애 보고서를 작성해줘. 1~2줄로 짧고 명확하게.' }],
      maxOutputTokens: 200,
    });
    console.log('\n[Groq Reporter Agent Response]');
    console.log(result.text);
    console.log('\n✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();
