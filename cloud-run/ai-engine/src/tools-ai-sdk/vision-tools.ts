/**
 * Vision Tools (AI SDK Format) - Structuring Only
 *
 * These tools structure and validate the LLM's visual analysis output.
 * Images are passed via message content (AI SDK best practice), NOT tool parameters.
 *
 * Pattern (Option C - Hybrid):
 * 1. User uploads image → message content [{ type: 'image', image: base64 }]
 * 2. Gemini analyzes image directly via multimodal input
 * 3. These tools structure the analysis results
 *
 * Tools:
 * - structureScreenshotAnalysis: Structure dashboard analysis output
 * - analyzeLargeLog: Large log file analysis (1M context)
 * - searchWithGrounding: Google Search Grounding for real-time docs
 * - analyzeUrlContent: URL content extraction and analysis
 *
 * @version 2.0.0 - Refactored to structuring-only pattern
 * @created 2026-01-27
 * @updated 2026-01-27 - Option C Hybrid implementation
 */

import { tool } from 'ai';
import { z } from 'zod';

// ============================================================================
// 1. Types
// ============================================================================

export interface ScreenshotAnalysisResult {
  success: boolean;
  dashboardType: string;
  focusArea?: FocusArea;
  findings: {
    anomalies: string[];
    trends: string[];
    thresholdBreaches: string[];
    recommendations: string[];
  };
  metrics: {
    name: string;
    currentValue: string;
    status: 'normal' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
  }[];
  timeRange?: string;
  summary: string;
}

export interface LogAnalysisResult {
  success: boolean;
  logType: string;
  totalLines: number;
  analyzedLines: number;
  findings: {
    errorCount: number;
    warnCount: number;
    topErrors: { message: string; count: number; firstSeen: string; lastSeen: string }[];
    patterns: { pattern: string; frequency: number; severity: string }[];
    timeline: { timestamp: string; event: string; severity: string }[];
  };
  rootCauseHypothesis?: string;
  recommendations: string[];
  summary: string;
}

export interface SearchGroundingResult {
  success: boolean;
  query: string;
  results: {
    title: string;
    snippet: string;
    url: string;
    relevanceScore: number;
  }[];
  summary: string;
  recommendations: string[];
}

export interface UrlContentResult {
  success: boolean;
  url: string;
  title: string;
  contentType: string;
  extractedSections: {
    heading: string;
    content: string;
    relevance: 'high' | 'medium' | 'low';
  }[];
  summary: string;
  applicableActions: string[];
}

// ============================================================================
// 2. Input Types
// ============================================================================

type DashboardType = 'grafana' | 'cloudwatch' | 'datadog' | 'prometheus' | 'newrelic' | 'custom' | 'unknown';
type FocusArea = 'cpu' | 'memory' | 'disk' | 'network' | 'latency' | 'errors' | 'all';
type LogType = 'syslog' | 'application' | 'access' | 'error' | 'security' | 'custom';
type SearchType = 'technical' | 'security' | 'documentation' | 'troubleshooting' | 'general';

// ============================================================================
// 3. Screenshot Analysis Tool (Structuring Only)
// ============================================================================

/**
 * Structure the LLM's visual analysis of dashboard screenshots
 *
 * IMPORTANT: This tool does NOT receive image data. Images are passed via
 * message content array (AI SDK best practice). This tool structures the
 * analysis output from the LLM's visual analysis.
 *
 * Flow:
 * 1. User message includes image: [{ type: 'image', image: base64 }]
 * 2. LLM analyzes image and calls this tool with findings
 * 3. This tool structures and validates the findings
 */
export const analyzeScreenshot = tool({
  description: `대시보드 스크린샷 분석 결과를 구조화합니다.

중요: 이미지는 메시지 content로 전달됩니다. 이 도구는 시각적 분석 결과를 구조화하는 데 사용됩니다.

이 도구를 호출하기 전에:
1. 사용자가 보낸 이미지를 먼저 분석하세요
2. 발견한 이상 징후, 트렌드, 문제점을 파악하세요
3. 그 결과를 이 도구의 파라미터로 전달하세요`,

  inputSchema: z.object({
    dashboardType: z
      .enum(['grafana', 'cloudwatch', 'datadog', 'prometheus', 'newrelic', 'custom', 'unknown'])
      .optional()
      .default('unknown')
      .describe('감지된 대시보드 유형'),
    focusArea: z
      .enum(['cpu', 'memory', 'disk', 'network', 'latency', 'errors', 'all'])
      .optional()
      .default('all')
      .describe('주요 분석 영역'),
    timeRange: z
      .string()
      .optional()
      .describe('대시보드에 표시된 시간 범위'),
    anomalies: z
      .array(z.string())
      .describe('발견된 이상 징후 목록'),
    trends: z
      .array(z.string())
      .optional()
      .default([])
      .describe('관찰된 트렌드'),
    thresholdBreaches: z
      .array(z.string())
      .optional()
      .default([])
      .describe('임계값 초과 항목 (빨간/노란 영역)'),
    metrics: z
      .array(z.object({
        name: z.string().describe('메트릭 이름'),
        currentValue: z.string().describe('현재 값'),
        status: z.enum(['normal', 'warning', 'critical']).describe('상태'),
        trend: z.enum(['up', 'down', 'stable']).describe('추세'),
      }))
      .optional()
      .default([])
      .describe('감지된 메트릭 목록'),
    recommendations: z
      .array(z.string())
      .optional()
      .default([])
      .describe('권장 조치'),
    summary: z
      .string()
      .describe('분석 요약 (1-2문장)'),
  }),

  execute: async ({
    dashboardType,
    focusArea,
    timeRange,
    anomalies,
    trends,
    thresholdBreaches,
    metrics,
    recommendations,
    summary,
  }: {
    dashboardType?: DashboardType;
    focusArea?: FocusArea;
    timeRange?: string;
    anomalies: string[];
    trends?: string[];
    thresholdBreaches?: string[];
    metrics?: { name: string; currentValue: string; status: 'normal' | 'warning' | 'critical'; trend: 'up' | 'down' | 'stable' }[];
    recommendations?: string[];
    summary: string;
  }) => {
    // Validate that we have meaningful analysis
    if (!anomalies || anomalies.length === 0) {
      // No anomalies might be valid (healthy dashboard)
      if (!summary) {
        return {
          success: false,
          error: '분석 결과가 제공되지 않았습니다. 이미지를 먼저 분석한 후 결과를 전달해주세요.',
          dashboardType: dashboardType || 'unknown',
          findings: { anomalies: [], trends: [], thresholdBreaches: [], recommendations: [] },
          metrics: [],
          summary: '분석 실패: 결과 없음',
        };
      }
    }

    const result: ScreenshotAnalysisResult = {
      success: true,
      dashboardType: dashboardType || 'unknown',
      focusArea,
      findings: {
        anomalies: anomalies || [],
        trends: trends || [],
        thresholdBreaches: thresholdBreaches || [],
        recommendations: recommendations || [],
      },
      metrics: metrics || [],
      timeRange,
      summary,
    };

    // Determine severity based on findings
    const hasCritical = metrics?.some(m => m.status === 'critical') ||
                       (thresholdBreaches && thresholdBreaches.length > 0);
    const hasWarning = metrics?.some(m => m.status === 'warning') ||
                      (anomalies && anomalies.length > 0);

    const severity = hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal';

    return {
      ...result,
      severity,
      analysisComplete: true,
    };
  },
});

// ============================================================================
// 4. Large Log Analysis Tool (Pre-processing + Structuring)
// ============================================================================

/**
 * Pre-process and structure log analysis
 *
 * For very large logs (>100K lines):
 * - Pass log content via message for Gemini's 1M context
 * - This tool provides quick pre-analysis stats
 * - LLM does deep analysis, then calls this to structure findings
 *
 * For normal logs:
 * - Tool receives log content and provides basic stats
 * - LLM performs analysis using both the stats and raw content
 */
export const analyzeLargeLog = tool({
  description: `대용량 로그 파일을 분석합니다. Gemini의 1M 토큰 컨텍스트를 활용하여 전체 로그를 분석하고 에러 패턴, 타임라인, 근본 원인을 추론합니다.

두 가지 모드:
1. **전처리 모드**: logContent 제공 시 → 기본 통계 + 에러 클러스터링
2. **구조화 모드**: analysisResult 제공 시 → LLM 분석 결과 구조화`,

  inputSchema: z.object({
    logContent: z
      .string()
      .optional()
      .describe('분석할 로그 텍스트 (전처리 모드)'),
    logType: z
      .enum(['syslog', 'application', 'access', 'error', 'security', 'custom'])
      .optional()
      .default('application')
      .describe('로그 유형'),
    timeRange: z
      .string()
      .optional()
      .describe('분석 시간 범위'),
    focusPattern: z
      .string()
      .optional()
      .describe('집중 분석할 패턴'),
    // Structuring mode inputs
    analysisResult: z
      .object({
        topErrors: z.array(z.object({
          message: z.string(),
          count: z.number(),
          firstSeen: z.string().optional(),
          lastSeen: z.string().optional(),
        })).optional(),
        patterns: z.array(z.object({
          pattern: z.string(),
          frequency: z.number(),
          severity: z.string(),
        })).optional(),
        timeline: z.array(z.object({
          timestamp: z.string(),
          event: z.string(),
          severity: z.string(),
        })).optional(),
        rootCauseHypothesis: z.string().optional(),
        recommendations: z.array(z.string()).optional(),
        summary: z.string(),
      })
      .optional()
      .describe('LLM 분석 결과 (구조화 모드)'),
  }),

  execute: async ({
    logContent,
    logType,
    timeRange,
    focusPattern,
    analysisResult,
  }: {
    logContent?: string;
    logType?: LogType;
    timeRange?: string;
    focusPattern?: string;
    analysisResult?: {
      topErrors?: { message: string; count: number; firstSeen?: string; lastSeen?: string }[];
      patterns?: { pattern: string; frequency: number; severity: string }[];
      timeline?: { timestamp: string; event: string; severity: string }[];
      rootCauseHypothesis?: string;
      recommendations?: string[];
      summary: string;
    };
  }) => {
    const actualLogType = logType || 'application';

    // Structuring mode: LLM has already analyzed, just structure the result
    if (analysisResult) {
      // Map topErrors to ensure required fields have values
      const mappedTopErrors = (analysisResult.topErrors || []).map(e => ({
        message: e.message,
        count: e.count,
        firstSeen: e.firstSeen || 'N/A',
        lastSeen: e.lastSeen || 'N/A',
      }));

      const result: LogAnalysisResult = {
        success: true,
        logType: actualLogType,
        totalLines: 0,
        analyzedLines: 0,
        findings: {
          errorCount: analysisResult.topErrors?.reduce((sum, e) => sum + e.count, 0) || 0,
          warnCount: 0,
          topErrors: mappedTopErrors,
          patterns: analysisResult.patterns || [],
          timeline: analysisResult.timeline || [],
        },
        rootCauseHypothesis: analysisResult.rootCauseHypothesis,
        recommendations: analysisResult.recommendations || [],
        summary: analysisResult.summary,
      };

      return {
        ...result,
        mode: 'structuring',
        analysisComplete: true,
      };
    }

    // Pre-processing mode: analyze log content
    if (!logContent || logContent.trim().length === 0) {
      return {
        success: false,
        error: 'logContent 또는 analysisResult 중 하나가 필요합니다.',
        logType: actualLogType,
        totalLines: 0,
        analyzedLines: 0,
        findings: { errorCount: 0, warnCount: 0, topErrors: [], patterns: [], timeline: [] },
        recommendations: [],
        summary: '분석 실패: 입력 데이터 없음',
      };
    }

    const lines = logContent.split('\n');
    const totalLines = lines.length;

    // Quick pre-analysis for structure
    const errorLines = lines.filter((l: string) =>
      /error|exception|fatal|critical/i.test(l)
    );
    const warnLines = lines.filter((l: string) =>
      /warn|warning/i.test(l)
    );

    // Quick error frequency analysis
    const errorCounts = new Map<string, number>();
    for (const line of errorLines.slice(0, 1000)) {
      const normalized = line
        .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/g, '[TIMESTAMP]')
        .replace(/\d+\.\d+\.\d+\.\d+/g, '[IP]')
        .replace(/[a-f0-9]{8,}/gi, '[HEX]')
        .substring(0, 200);

      errorCounts.set(normalized, (errorCounts.get(normalized) || 0) + 1);
    }

    const sortedErrors = [...errorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const result: LogAnalysisResult = {
      success: true,
      logType: actualLogType,
      totalLines,
      analyzedLines: totalLines,
      findings: {
        errorCount: errorLines.length,
        warnCount: warnLines.length,
        topErrors: sortedErrors.map(([message, count]) => ({
          message,
          count,
          firstSeen: 'N/A',
          lastSeen: 'N/A',
        })),
        patterns: [],
        timeline: [],
      },
      recommendations: [],
      summary: `${actualLogType} 로그 전처리 완료: ${totalLines}줄, ERROR: ${errorLines.length}건, WARN: ${warnLines.length}건`,
    };

    return {
      ...result,
      mode: 'preprocessing',
      focusPattern,
      timeRange,
      // Provide hints for LLM's deep analysis
      analysisHints: {
        highErrorCount: errorLines.length > 100,
        commonPatterns: sortedErrors.slice(0, 3).map(([msg]) => msg),
        suggestedFocus: focusPattern || (errorLines.length > 0 ? 'ERROR' : 'WARN'),
      },
    };
  },
});

// ============================================================================
// 5. Google Search Grounding Tool
// ============================================================================

/**
 * Search with Google Grounding for real-time technical documentation
 *
 * Best for:
 * - Error message solutions
 * - Latest security advisories (CVEs)
 * - Official documentation references
 * - Best practices and guides
 */
export const searchWithGrounding = tool({
  description: `Google Search Grounding을 사용하여 실시간 기술 문서와 해결책을 검색합니다. 에러 메시지 해결, 최신 보안 정보, 공식 문서 참조에 적합합니다.

사용 예시:
- "OOM killed 에러 해결 방법"
- "Redis 7 메모리 최적화 가이드"
- "CVE-2024-xxxxx 보안 패치"`,

  inputSchema: z.object({
    query: z
      .string()
      .describe('검색 쿼리'),
    searchType: z
      .enum(['technical', 'security', 'documentation', 'troubleshooting', 'general'])
      .optional()
      .default('technical')
      .describe('검색 유형'),
    preferredSources: z
      .array(z.string())
      .optional()
      .describe('선호 소스 도메인 (예: ["docs.aws.amazon.com", "kubernetes.io"])'),
    maxResults: z
      .number()
      .optional()
      .default(5)
      .describe('최대 결과 수'),
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
    // Note: Actual search will be performed by Gemini with Search Grounding
    // This tool structures the request

    const actualSearchType = searchType || 'technical';
    const actualMaxResults = maxResults || 5;

    const result: SearchGroundingResult = {
      success: true,
      query,
      results: [],
      summary: '',
      recommendations: [],
    };

    // Build search context based on type
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

    // Add search context for Gemini
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

// ============================================================================
// 6. URL Content Analysis Tool
// ============================================================================

/**
 * Analyze content from external URLs
 *
 * Capabilities:
 * - Extract relevant sections from documentation
 * - Summarize technical articles
 * - Parse GitHub issues and Stack Overflow answers
 */
export const analyzeUrlContent = tool({
  description: `URL의 콘텐츠를 가져와 분석합니다. 기술 문서, GitHub 이슈, Stack Overflow 답변 등에서 관련 정보를 추출합니다.

사용 예시:
- "이 문서에서 설정 방법 찾아줘: [URL]"
- "이 GitHub 이슈 분석해줘"
- "Stack Overflow 답변 요약해줘"`,

  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe('분석할 URL'),
    extractSections: z
      .array(z.string())
      .optional()
      .describe('추출할 섹션 키워드 (예: ["installation", "configuration"])'),
    analysisGoal: z
      .string()
      .optional()
      .describe('분석 목표 (예: "Redis 설정 방법 찾기")'),
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

    // Detect content type from URL
    if (url.includes('github.com')) {
      result.contentType = url.includes('/issues/') ? 'github-issue' :
                          url.includes('/pull/') ? 'github-pr' :
                          url.includes('/blob/') ? 'github-code' : 'github';
    } else if (url.includes('stackoverflow.com')) {
      result.contentType = 'stackoverflow';
    } else if (url.includes('docs.')) {
      result.contentType = 'documentation';
    } else {
      result.contentType = 'article';
    }

    result.summary = `${result.contentType} 콘텐츠 분석 준비 완료`;

    // Add analysis context for Gemini
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

// ============================================================================
// 7. Vision Tools Collection
// ============================================================================

/**
 * All vision tools for Vision Agent
 *
 * Usage Pattern (Option C - Hybrid):
 * 1. Images are passed via message content: [{ type: 'image', image: base64 }]
 * 2. LLM analyzes images directly using multimodal capability
 * 3. These tools structure the analysis output for consistent response format
 *
 * @example
 * // In BaseAgent.buildUserContent():
 * messages: [{
 *   role: 'user',
 *   content: [
 *     { type: 'text', text: '이 대시보드 분석해줘' },
 *     { type: 'image', image: 'base64...', mimeType: 'image/png' }
 *   ]
 * }]
 *
 * // Then LLM calls analyzeScreenshot with findings:
 * analyzeScreenshot({
 *   anomalies: ['CPU 95% 스파이크'],
 *   summary: 'CPU 과부하 감지'
 * })
 */
export const visionTools = {
  analyzeScreenshot,
  analyzeLargeLog,
  searchWithGrounding,
  analyzeUrlContent,
};

/**
 * Vision tool descriptions for routing
 *
 * Note: These are "structuring tools" - they format the LLM's analysis,
 * not perform the actual visual analysis.
 */
export const visionToolDescriptions = {
  analyzeScreenshot: '스크린샷 분석 결과 구조화 (이미지는 message content로 전달)',
  analyzeLargeLog: '로그 분석 전처리 + 결과 구조화',
  searchWithGrounding: 'Google Search Grounding 실시간 검색',
  analyzeUrlContent: 'URL 콘텐츠 추출 및 분석',
};
