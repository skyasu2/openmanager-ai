import type { UIMessage } from '@ai-sdk/react';
import { getComplexityThreshold } from '@/config/ai-proxy.config';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import { buildFrontendQueryRoutingDecision } from './query-routing';

const QA_THINKING_VISUALIZER_PROMPT = '/qa-thinking-visualizer';
const DEBUG_ROUTING_PROMPT = '/debug-routing';

export function isQAThinkingVisualizerPrompt(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.includes(QA_THINKING_VISUALIZER_PROMPT);
}

export function isDebugRoutingPrompt(text: string): boolean {
  return text.trim().toLowerCase().startsWith(DEBUG_ROUTING_PROMPT);
}

export function createDebugRoutingMessages(
  fullText: string,
  analysisMode: AnalysisMode
): [UIMessage, UIMessage] {
  const query = fullText.replace(/^\/debug-routing\s*/i, '').trim();
  const token = Date.now().toString(36);

  const threshold = getComplexityThreshold();
  const routingDecision = buildFrontendQueryRoutingDecision({
    query: query || '(쿼리 없음)',
    complexityThreshold: threshold,
    analysisMode,
  });
  const {
    analysis,
    forceJobQueue: forceResult,
    modeAdjustedThreshold,
    queryMode,
  } = routingDecision;

  const isComplex = queryMode === 'job-queue';
  const routePath = isComplex
    ? 'Job Queue (/api/ai/jobs)'
    : 'Streaming (/api/ai/supervisor/stream/v2)';

  const factorLines =
    analysis.factors.length > 0
      ? analysis.factors.map((factor) => `  · ${factor}`).join('\n')
      : '  · (없음)';

  const forceNote = forceResult.force
    ? `\n⚡ 강제 Job Queue: 키워드 "${forceResult.matchedKeyword}" 감지`
    : '';

  const thinkingNote =
    analysisMode === 'thinking'
      ? `\n🧠 thinking 모드: threshold ${threshold} → ${modeAdjustedThreshold} (−8)`
      : '';

  const resultText =
    `🔍 **Routing Debug**\n` +
    `\`\`\`\n` +
    `쿼리:       ${query || '(없음)'}\n` +
    `복잡도:     ${analysis.level} (score: ${analysis.score})\n` +
    `threshold:  ${modeAdjustedThreshold} (기본값: ${threshold})\n` +
    `경로:       ${isComplex ? '🔄 ' : '⚡ '}${routePath}\n` +
    `\`\`\`\n` +
    `**factors**\n${factorLines}` +
    forceNote +
    thinkingNote;

  const userMessage: UIMessage = {
    id: `debug-user-${token}`,
    role: 'user',
    parts: [{ type: 'text', text: fullText }],
  };
  const assistantMessage: UIMessage = {
    id: `debug-assistant-${token}`,
    role: 'assistant',
    parts: [{ type: 'text', text: resultText }],
  };

  return [userMessage, assistantMessage];
}

function createQAToolResultSummaries() {
  return [
    {
      toolName: 'analyzeIntent',
      label: '의도 분석',
      summary: '질문의 핵심 의도를 분석해 서버 진단 요청으로 분류했습니다.',
      status: 'completed' as const,
    },
    {
      toolName: 'selectRoute',
      label: '라우팅 결정',
      summary: '실시간 메트릭 기반 분석 경로를 선택했습니다.',
      status: 'completed' as const,
    },
    {
      toolName: 'generateInsight',
      label: '인사이트 생성',
      summary: '우선 조치 항목과 근거를 구조화했습니다.',
      status: 'completed' as const,
    },
  ];
}

export function createQAAssistantMessages(
  text: string
): [UIMessage, UIMessage] {
  const token = Date.now().toString(36);
  const userMessage: UIMessage = {
    id: `qa-user-${token}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
  const assistantMessage: UIMessage = {
    id: `qa-assistant-${token}`,
    role: 'assistant',
    parts: [
      {
        type: 'text',
        text: 'QA thinking visualizer 샘플 응답입니다. AI 처리 과정 토글을 펼쳐 단계 렌더링을 확인하세요.',
      },
    ],
    metadata: {
      traceId: `qa-trace-${token}`,
      toolsCalled: ['analyzeIntent', 'selectRoute', 'generateInsight'],
      toolResultSummaries: createQAToolResultSummaries(),
    },
  };

  return [userMessage, assistantMessage];
}
