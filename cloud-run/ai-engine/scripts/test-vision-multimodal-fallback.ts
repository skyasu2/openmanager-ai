import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import { runAgent } from '../src/services/ai-sdk/agents/agent-factory';

async function main() {
  console.log('--- Multimodal Vision Test ---');

  const projectRoot = path.join(__dirname, '../../../');
  const imagePath = path.join(projectRoot, 'public/dashboard-icon.png');
  
  if (!fs.existsSync(imagePath)) {
    console.error('Image not found');
    process.exit(1);
  }

  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const query = "이 이미지에 무엇이 보이는지 아주 짧게 설명해줘.";
  
  try {
    const result = await runAgent('vision', query, {
      images: [
        {
          data: base64Image,
          mimeType: 'image/png',
          name: 'dashboard-icon.png'
        }
      ],
      maxOutputTokens: 150
    });

    if (result && result.success) {
      console.log('Response:', result.text);
      console.log('Provider:', result.metadata.provider);
      console.log('Model:', result.metadata.modelId);
      if (result.metadata.fallbackUsed) {
        console.log('Fallback:', result.metadata.fallbackReason);
      }
    } else {
      console.error('Error:', result?.error);
    }
  } catch (error) {
    console.error('Failed:', error);
  }
}

main();
