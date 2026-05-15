const TOOL_LABELS: Record<string, string> = {
  getServerMetrics: '서버 메트릭 조회',
  getServerMetricsAdvanced: '서버 메트릭 상세 조회',
  filterServers: '서버 필터링',
  getServerByGroup: '서버 그룹 조회',
  getServerLogs: '시스템 로그 조회',
  findRootCause: '근본 원인 분석',
  correlateMetrics: '메트릭 상관 분석',
  buildIncidentTimeline: '인시던트 타임라인',
  detectAnomalies: '이상 탐지',
  detectAnomaliesAllServers: '전체 서버 이상 탐지',
  predictTrends: '단기 위험 추세 계산',
  analyzePattern: '패턴 분석',
  searchKnowledgeBase: '지식 근거 검색',
  recommendCommands: 'CLI 명령어 추천',
  searchWeb: '웹 검색',
  finalAnswer: '최종 응답',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

function truncatePreview(value: string, maxLength = 260): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatToolPreview(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return truncatePreview(String(value));
  }

  try {
    return truncatePreview(JSON.stringify(value, null, 2));
  } catch {
    return undefined;
  }
}

function extractToolSummary(toolName: string, output: unknown): string {
  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.summary === 'string' && record.summary.trim()) {
      return record.summary.trim();
    }
    if (typeof record.answer === 'string' && record.answer.trim()) {
      return truncatePreview(record.answer.trim(), 140);
    }
    if (Array.isArray(record.results)) {
      return `${record.results.length}개 결과를 반환했습니다.`;
    }
    if (Array.isArray(record.items)) {
      return `${record.items.length}개 항목을 조회했습니다.`;
    }
    if (typeof record.count === 'number') {
      return `${record.count}개 항목을 처리했습니다.`;
    }
    if (record.success === false) {
      if (typeof record.error === 'string' && record.error.trim()) {
        return record.error.trim();
      }
      if (typeof record.reason === 'string' && record.reason.trim()) {
        return record.reason.trim();
      }
      return `${getToolLabel(toolName)} 실행이 실패했습니다.`;
    }
  }

  if (Array.isArray(output)) {
    return `${output.length}개 항목을 반환했습니다.`;
  }

  if (typeof output === 'string' && output.trim()) {
    return truncatePreview(output.trim(), 140);
  }

  return `${getToolLabel(toolName)} 실행을 완료했습니다.`;
}

export function buildToolResultSummary(toolName: string, output: unknown) {
  return {
    toolName,
    label: getToolLabel(toolName),
    summary: extractToolSummary(toolName, output),
    preview: formatToolPreview(output),
    status: 'completed' as const,
  };
}
