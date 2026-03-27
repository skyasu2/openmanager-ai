import { tool } from 'ai';
import { z } from 'zod';
import type { CommandRecommendation } from './knowledge-types';

export const recommendCommands = tool({
  description: '사용자 질문에 적합한 CLI 명령어를 추천합니다',
  inputSchema: z.object({
    keywords: z.array(z.string()).describe('질문에서 추출한 핵심 키워드'),
  }),
  execute: async ({ keywords }: { keywords: string[] }) => {
    const recommendations: CommandRecommendation[] = [
      {
        keywords: ['서버', '목록', '조회'],
        command: 'list servers',
        description: '서버 목록 조회',
      },
      {
        keywords: ['상태', '체크', '확인'],
        command: 'status check',
        description: '시스템 상태 점검',
      },
      {
        keywords: ['로그', '분석', '에러'],
        command: 'analyze logs',
        description: '로그 분석',
      },
      {
        keywords: ['재시작', 'restart', '복구'],
        command: 'service restart <service_name>',
        description: '서비스 재시작',
      },
      {
        keywords: ['메모리', '정리', 'cache'],
        command: 'clear cache',
        description: '캐시 정리',
      },
      {
        keywords: ['cpu', '프로세서', '부하'],
        command: 'top -o cpu',
        description: 'CPU 사용량 상위 프로세스 조회',
      },
      {
        keywords: ['디스크', '용량', 'disk'],
        command: 'df -h',
        description: '디스크 사용량 조회',
      },
      {
        keywords: ['네트워크', 'network', '연결'],
        command: 'netstat -an',
        description: '네트워크 연결 상태 조회',
      },
    ];

    const matched = recommendations.filter((rec) =>
      keywords.some((k) =>
        rec.keywords.some(
          (rk) =>
            rk.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(rk.toLowerCase()),
        ),
      ),
    );

    const result = matched.length > 0 ? matched : recommendations.slice(0, 3);

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
