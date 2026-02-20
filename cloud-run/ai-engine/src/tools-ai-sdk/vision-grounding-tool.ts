import { tool } from 'ai';
import { z } from 'zod';
import type { SearchGroundingResult, SearchType } from './vision-types';

export const searchWithGrounding = tool({
  description: `Google Search Grounding을 사용하여 실시간 기술 문서와 해결책을 검색합니다. 에러 메시지 해결, 최신 보안 정보, 공식 문서 참조에 적합합니다.

사용 예시:
- "OOM killed 에러 해결 방법"
- "Redis 7 메모리 최적화 가이드"
- "CVE-2024-xxxxx 보안 패치"`,

  inputSchema: z.object({
    query: z.string().describe('검색 쿼리'),
    searchType: z
      .enum([
        'technical',
        'security',
        'documentation',
        'troubleshooting',
        'general',
      ])
      .optional()
      .default('technical')
      .describe('검색 유형'),
    preferredSources: z
      .array(z.string())
      .optional()
      .describe('선호 소스 도메인 (예: ["docs.aws.amazon.com", "kubernetes.io"])'),
    maxResults: z.number().optional().default(5).describe('최대 결과 수'),
  }),

  execute: async ({
    query,
    searchType,
    preferredSources,
    maxResults,
  }: {
    query: string;
    searchType?: SearchType;
    preferredSources?: string[];
    maxResults?: number;
  }) => {
    const actualSearchType = searchType || 'technical';
    const actualMaxResults = maxResults || 5;

    const result: SearchGroundingResult = {
      success: true,
      query,
      results: [],
      summary: '',
      recommendations: [],
    };

    let searchContext = '';
    switch (actualSearchType) {
      case 'security':
        searchContext = 'CVE, 보안 취약점, 패치, security advisory';
        break;
      case 'documentation':
        searchContext = '공식 문서, API 레퍼런스, 가이드';
        break;
      case 'troubleshooting':
        searchContext = '에러 해결, 트러블슈팅, 디버깅';
        break;
      case 'technical':
      default:
        searchContext = '기술 문서, 베스트 프랙티스, 구현 가이드';
    }

    result.summary = `"${query}" 검색 준비 완료. 유형: ${actualSearchType}, 최대 결과: ${actualMaxResults}`;

    const analysisContext = {
      searchType: actualSearchType,
      preferredSources,
      maxResults: actualMaxResults,
      searchInstructions: `
Google Search Grounding을 사용하여 다음을 검색하세요:

**쿼리**: ${query}
**검색 유형**: ${actualSearchType} (${searchContext})
${preferredSources?.length ? `**선호 소스**: ${preferredSources.join(', ')}` : ''}

검색 결과에서:
1. 가장 관련성 높은 ${actualMaxResults}개 결과 선택
2. 각 결과의 핵심 내용 요약
3. 현재 문제에 적용 가능한 해결책 추출
4. 출처 URL 명시

결과를 구조화된 형식으로 제공하세요.
      `.trim(),
    };

    return {
      ...result,
      analysisContext,
    };
  },
});
