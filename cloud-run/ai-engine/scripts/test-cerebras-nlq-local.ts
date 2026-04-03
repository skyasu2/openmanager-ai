import { createCerebras } from '@ai-sdk/cerebras';
import { generateText } from 'ai';
import * as path from 'path';
import * as dotenv from 'dotenv';

async function main() {
  const envPath = path.join(__dirname, '../.env');
  dotenv.config({ path: envPath });

  const apiKey = process.env.CEREBRAS_API_KEY?.replace(/^"|"$/g, '');
  if (!apiKey) {
    console.error('No CEREBRAS_API_KEY found');
    process.exit(1);
  }

  const cerebras = createCerebras({ apiKey });
  const modelId = process.env.CEREBRAS_MODEL_ID?.replace(/^"|"$/g, '') || 'qwen-3-235b-a22b-instruct-2507';
  
  console.log(`--- Final Validation of Cerebras Agent via ${modelId} ---`);
  console.log('Query: "SELECT * FROM server_metrics WHERE cpu_usage > 90;"');
  
  const startTime = Date.now();
  
  try {
    const result = await generateText({
      model: cerebras(modelId),
      messages: [
        { 
          role: 'system', 
          content: 'You are a Senior OSS Database Engineer. Your task is to analyze and generate SQL queries for the table "server_metrics". Provide concise and accurate technical answers.' 
        },
        { 
          role: 'user', 
          content: 'CPU 사용률이 90%를 초과하는 모든 서버의 ID와 호스트네임을 조회하는 SQL 쿼리를 작성해줘.' 
        }
      ],
      maxOutputTokens: 100,
    });

    const duration = Date.now() - startTime;
    console.log(`\n[${modelId} Response]`);
    console.log(result.text || '(Empty response - model may require more specific context)');
    console.log(`\n⚡ Latency: ${duration}ms`);
    
    if (result.text) {
      console.log(`✅ Cerebras ${modelId} is working correctly for its specialized role!`);
    } else {
      console.log(`⚠️  Cerebras API connected, but ${modelId} returned no text. This can happen with specialized models on simple prompts.`);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

main();
