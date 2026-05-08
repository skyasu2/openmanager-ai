import { tool } from 'ai';
import { z } from 'zod';
import { getCommandRecommendations } from './knowledge-command-catalog';

export const recommendCommands = tool({
  description: '사용자 질문에 적합한 CLI 명령어를 추천합니다',
  inputSchema: z.object({
    keywords: z.array(z.string()).describe('질문에서 추출한 핵심 키워드'),
  }),
  execute: async ({ keywords }: { keywords: string[] }) => {
    const result = getCommandRecommendations(keywords);

    return {
      success: true,
      recommendations: result.map((r) => ({
        command: r.command,
        description: r.description,
      })),
      matchedKeywords: keywords,
      _mode: 'command-recommendation',
    };
  },
});
