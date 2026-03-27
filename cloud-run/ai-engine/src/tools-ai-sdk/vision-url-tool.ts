import { tool } from 'ai';
import { z } from 'zod';
import type { UrlContentResult } from './vision-types';

export const analyzeUrlContent = tool({
  description: `URL의 콘텐츠를 가져와 분석합니다. 기술 문서, GitHub 이슈, Stack Overflow 답변 등에서 관련 정보를 추출합니다.

사용 예시:
- "이 문서에서 설정 방법 찾아줘: [URL]"
- "이 GitHub 이슈 분석해줘"
- "Stack Overflow 답변 요약해줘"`,

  inputSchema: z.object({
    url: z.string().url().describe('분석할 URL'),
    extractSections: z
      .array(z.string())
      .optional()
      .describe('추출할 섹션 키워드 (예: ["installation", "configuration"])'),
    analysisGoal: z.string().optional().describe('분석 목표 (예: "Redis 설정 방법 찾기")'),
  }),

  execute: async ({
    url,
    extractSections,
    analysisGoal,
  }: {
    url: string;
    extractSections?: string[];
    analysisGoal?: string;
  }) => {
    const result: UrlContentResult = {
      success: true,
      url,
      title: '',
      contentType: 'unknown',
      extractedSections: [],
      summary: '',
      applicableActions: [],
    };

    if (url.includes('github.com')) {
      result.contentType = url.includes('/issues/')
        ? 'github-issue'
        : url.includes('/pull/')
          ? 'github-pr'
          : url.includes('/blob/')
            ? 'github-code'
            : 'github';
    } else if (url.includes('stackoverflow.com')) {
      result.contentType = 'stackoverflow';
    } else if (url.includes('docs.')) {
      result.contentType = 'documentation';
    } else {
      result.contentType = 'article';
    }

    result.summary = `${result.contentType} 콘텐츠 분석 준비 완료`;

    const analysisContext = {
      url,
      contentType: result.contentType,
      extractSections,
      analysisGoal,
      analysisInstructions: `
이 URL의 콘텐츠를 분석하세요: ${url}

**콘텐츠 유형**: ${result.contentType}
${analysisGoal ? `**분석 목표**: ${analysisGoal}` : ''}
${extractSections?.length ? `**추출 섹션**: ${extractSections.join(', ')}` : ''}

분석 내용:
1. 문서 제목과 주요 내용 요약
2. ${extractSections?.length ? '요청된 섹션 추출' : '관련 섹션 식별 및 추출'}
3. 현재 문제에 적용 가능한 정보 하이라이트
4. 구체적인 적용 방법이나 명령어 추출

결과를 구조화된 형식으로 제공하세요.
      `.trim(),
    };

    return {
      ...result,
      analysisContext,
    };
  },
});
