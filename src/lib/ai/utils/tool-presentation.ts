import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';

type ToolPresentation = {
  label: string;
  description: string;
};

const TOOL_PRESENTATIONS: Record<string, ToolPresentation> = {
  getServerMetrics: {
    label: '서버 메트릭 조회',
    description: '선택한 서버의 CPU, 메모리, 디스크 등 핵심 상태를 확인합니다.',
  },
  getServerMetricsAdvanced: {
    label: '서버 메트릭 상세 조회',
    description: '문제가 의심되는 서버의 세부 지표를 더 깊게 확인합니다.',
  },
  filterServers: {
    label: '대상 서버 추리기',
    description: '질문과 관련 있는 서버만 골라 분석 대상을 좁힙니다.',
  },
  getServerByGroup: {
    label: '서버 그룹 조회',
    description: '같은 역할의 서버를 묶어 비교할 대상을 찾습니다.',
  },
  getServerLogs: {
    label: '시스템 로그 조회',
    description: '최근 오류나 경고 로그를 확인해 원인 단서를 찾습니다.',
  },
  findRootCause: {
    label: '원인 추정',
    description: '관측된 징후를 바탕으로 가장 가능성 높은 원인을 추정합니다.',
  },
  correlateMetrics: {
    label: '관련 지표 비교',
    description: '여러 메트릭 변화를 함께 비교해 연관 징후를 확인합니다.',
  },
  buildIncidentTimeline: {
    label: '이상 발생 순서 정리',
    description: '문제가 어떻게 번졌는지 시간 순서로 정리합니다.',
  },
  detectAnomalies: {
    label: '이상 징후 확인',
    description: '서버 상태가 평소 범위나 임계값에서 벗어났는지 확인합니다.',
  },
  detectAnomaliesAllServers: {
    label: '전체 서버 이상 징후 확인',
    description: '전체 서버를 빠르게 훑어 우선 확인할 대상을 찾습니다.',
  },
  predictTrends: {
    label: '단기 위험 추세 계산',
    description: '최근 추세를 기준으로 가까운 시간의 위험 가능성을 계산합니다.',
  },
  analyzePattern: {
    label: '패턴 비교',
    description: '반복되는 이상 패턴이나 유사 사례를 비교합니다.',
  },
  searchKnowledgeBase: {
    label: '내부 지식 검색',
    description: '기존 장애 기록과 운영 지식을 찾아 현재 상황과 비교합니다.',
  },
  recommendCommands: {
    label: '조치 명령어 정리',
    description: '운영자가 바로 실행할 수 있는 점검·조치 명령어를 제안합니다.',
  },
  searchWeb: {
    label: '웹 자료 확인',
    description: '공식 문서나 외부 자료를 찾아 최신 정보를 보완합니다.',
  },
  finalAnswer: {
    label: '최종 응답 정리',
    description:
      '앞 단계 결과를 묶어 사용자에게 전달할 답변 형태로 정리합니다.',
  },
};

export function hasToolPresentation(toolName: string): boolean {
  return toolName in TOOL_PRESENTATIONS;
}

export function getToolLabel(toolName: string): string {
  return TOOL_PRESENTATIONS[toolName]?.label ?? toolName;
}

export function getToolDescription(toolName: string): string | null {
  return TOOL_PRESENTATIONS[toolName]?.description ?? null;
}

export function getToolPresentation(toolName: string): {
  label: string;
  description: string | null;
  technicalName: string | null;
} {
  return {
    label: getToolLabel(toolName),
    description: getToolDescription(toolName),
    technicalName: hasToolPresentation(toolName) ? toolName : null,
  };
}

export function getThinkingStepPresentation(
  step:
    | Pick<AIThinkingStep, 'step' | 'title' | 'description'>
    | null
    | undefined
): {
  title: string;
  description: string | null;
  technicalName: string | null;
} {
  const rawStep = step?.step?.trim() ?? '';
  const title =
    step?.title?.trim() ||
    (rawStep ? getToolLabel(rawStep) : '') ||
    '처리 단계';
  const technicalName =
    rawStep && rawStep !== title && hasToolPresentation(rawStep)
      ? rawStep
      : null;

  return {
    title,
    description: step?.description?.trim() || getToolDescription(rawStep),
    technicalName,
  };
}
