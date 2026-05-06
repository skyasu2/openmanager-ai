import type {
  AgentRole,
  AgentRoleRegistry,
} from '../../core/assistant-runtime';

export const MONITORING_AGENT_ROLES = [
  {
    id: 'nlq',
    name: 'NLQ Agent',
    description:
      '서버 상태 조회, CPU/메모리/디스크 메트릭 질의, 시간 범위 집계(지난 N시간 평균/최대), 서버 목록 확인 및 필터링, 상태 요약, 웹 검색을 처리합니다.',
    matchPatterns: [
      '서버',
      '상태',
      '목록',
      '조회',
      '알려',
      '보여',
      'cpu',
      'CPU',
      '메모리',
      'memory',
      '디스크',
      'disk',
      '네트워크',
      'network',
      '지난',
      '시간',
      '전체',
      /\d+%/i,
      /이상|이하|초과|미만/i,
      /몇\s*개|몇\s*대/i,
      /평균|합계|최대|최소/i,
      /높은|낮은|많은|적은/i,
      /지난\s*\d+\s*시간/i,
      '요약',
      '간단히',
      '핵심',
      'TL;DR',
      'tldr',
      'summary',
      /요약.*해|간단.*알려/i,
      '검색',
      'search',
      '찾아',
      '뭐야',
      '뭔가요',
      '알려줘',
      /에러|error|오류/i,
      /해결|solution|fix/i,
      /방법|how to/i,
    ],
    capabilities: [
      'metric-query',
      'server-filtering',
      'status-summary',
      'web-search',
    ],
    runtimeConfigKey: 'NLQ Agent',
  },
  {
    id: 'analyst',
    name: 'Analyst Agent',
    description:
      '이상 탐지, 트렌드 예측, 패턴 분석, 근본 원인 분석(RCA), 상관관계 분석을 수행합니다. "왜?", "이상 있어?", "예측해줘" 질문에 적합합니다.',
    matchPatterns: [
      '이상',
      '비정상',
      'anomaly',
      '스파이크',
      'spike',
      '예측',
      '트렌드',
      '추세',
      '향후',
      'predict',
      '분석',
      '패턴',
      '원인',
      '왜',
      /이상\s*(있|징후|탐지)/i,
      /언제.*될|고갈/i,
    ],
    capabilities: [
      'anomaly-detection',
      'trend-prediction',
      'root-cause-analysis',
    ],
    runtimeConfigKey: 'Analyst Agent',
  },
  {
    id: 'reporter',
    name: 'Reporter Agent',
    description:
      '장애 보고서 생성, 인시던트 타임라인 구성, 영향도 분석 보고서를 작성합니다. "보고서 만들어줘", "장애 정리" 요청에 적합합니다.',
    matchPatterns: [
      '보고서',
      '리포트',
      'report',
      '장애',
      '인시던트',
      'incident',
      '사고',
      '타임라인',
      'timeline',
      '시간순',
      '정리',
      /보고서.*만들|생성/i,
      /장애.*정리|요약/i,
    ],
    capabilities: [
      'incident-report',
      'incident-timeline',
      'impact-analysis',
    ],
    runtimeConfigKey: 'Reporter Agent',
  },
  {
    id: 'advisor',
    name: 'Advisor Agent',
    description:
      '문제 해결 방법, CLI 명령어 추천, 과거 장애 사례 검색, 트러블슈팅 가이드, 웹 검색을 제공합니다. "어떻게 해결?", "명령어 알려줘" 질문에 적합합니다.',
    matchPatterns: [
      '해결',
      '방법',
      '어떻게',
      '조치',
      '명령어',
      'command',
      '실행',
      'cli',
      '가이드',
      '도움',
      '추천',
      '안내',
      '과거',
      '사례',
      '이력',
      '비슷한',
      '유사',
      /어떻게.*해결|해결.*방법/i,
      /명령어.*알려|추천.*명령/i,
      /\?$/,
    ],
    capabilities: [
      'troubleshooting',
      'command-recommendation',
      'case-search',
      'web-search',
    ],
    runtimeConfigKey: 'Advisor Agent',
  },
  {
    id: 'vision',
    name: 'Vision Agent',
    description:
      '대시보드 스크린샷 및 첨부 이미지 분석을 수행합니다. 이미지 기반의 시각 정보 추출에 적합합니다.',
    matchPatterns: [
      '스크린샷',
      'screenshot',
      '이미지',
      'image',
      '사진',
      '차트',
      '그래프',
      '패널',
      '대시보드',
      'dashboard',
      'grafana',
      'cloudwatch',
      'datadog',
      /스크린샷.*분석|분석.*스크린샷/i,
      /이미지.*보여|첨부.*분석|시각.*분석/i,
    ],
    capabilities: ['image-analysis', 'dashboard-screenshot-analysis'],
    runtimeConfigKey: 'Vision Agent',
  },
  {
    id: 'evaluator',
    name: 'Evaluator Agent',
    description:
      '[Pipeline-Internal, Deterministic] 생성된 장애 보고서의 품질을 결정론적으로 평가합니다. 구조 완성도, 내용 완성도, 근본원인 분석 정확도, 조치 실행가능성을 점수화합니다.',
    matchPatterns: [],
    capabilities: ['incident-report-quality-scoring'],
    runtimeConfigKey: 'Evaluator Agent',
  },
  {
    id: 'optimizer',
    name: 'Optimizer Agent',
    description:
      '[Pipeline-Internal, Deterministic] 낮은 품질의 장애 보고서를 개선합니다. precomputed-state 히스토리 기반 근본원인 심화, CLI 명령어 추가, 서버 연관성 확장.',
    matchPatterns: [],
    capabilities: ['incident-report-refinement'],
    runtimeConfigKey: 'Optimizer Agent',
  },
] as const satisfies readonly AgentRole[];

const MONITORING_AGENT_ROLES_BY_ID: ReadonlyMap<string, AgentRole> = new Map(
  MONITORING_AGENT_ROLES.map((role): [string, AgentRole] => [role.id, role])
);

const MONITORING_AGENT_ROLES_BY_NAME: ReadonlyMap<string, AgentRole> = new Map(
  MONITORING_AGENT_ROLES.map((role): [string, AgentRole] => [role.name, role])
);

const MONITORING_AGENT_ROLES_BY_RUNTIME_CONFIG_KEY: ReadonlyMap<
  string,
  AgentRole
> = new Map(
  MONITORING_AGENT_ROLES.flatMap((role): Array<[string, AgentRole]> =>
    role.runtimeConfigKey
      ? [[role.runtimeConfigKey, role]]
      : []
  )
);

export type MonitoringAgentRole = (typeof MONITORING_AGENT_ROLES)[number];
export type MonitoringAgentRoleId = MonitoringAgentRole['id'];

function cloneAgentRole(role: AgentRole): AgentRole {
  return {
    ...role,
    ...(role.matchPatterns ? { matchPatterns: [...role.matchPatterns] } : {}),
    ...(role.capabilities ? { capabilities: [...role.capabilities] } : {}),
  };
}

export const monitoringAgentRoleRegistry: AgentRoleRegistry = {
  listRoles(): AgentRole[] {
    return MONITORING_AGENT_ROLES.map(cloneAgentRole);
  },
  resolveRole(id: string): AgentRole | undefined {
    const role = MONITORING_AGENT_ROLES_BY_ID.get(id);
    return role ? cloneAgentRole(role) : undefined;
  },
};

export function resolveMonitoringAgentRoleByName(
  name: string
): AgentRole | undefined {
  const role = MONITORING_AGENT_ROLES_BY_NAME.get(name);
  return role ? cloneAgentRole(role) : undefined;
}

export function resolveMonitoringAgentRoleByRuntimeConfigKey(
  runtimeConfigKey: string
): AgentRole | undefined {
  const role = MONITORING_AGENT_ROLES_BY_RUNTIME_CONFIG_KEY.get(runtimeConfigKey);
  return role ? cloneAgentRole(role) : undefined;
}
