import type { SupportedMetric } from './current-metrics-evidence-request';

export const HISTORICAL_OR_TREND_PATTERN =
  /(지난\s*\d|최근\s*\d|24\s*시간|하루|어제|last\s+\d|last24h|past\s+\d|평균|avg|추세|트렌드|trend|예측|forecast|비교|대비|변화|compare)/i;
export const SERVER_HEALTH_PATTERN =
  /(?:서버|인프라|시스템|fleet|server|infra|system).{0,20}(상태|현황|요약|health|summary|status)|(?:상태|현황|요약|health|summary|status).{0,20}(서버|인프라|시스템|fleet|server|infra|system)/i;
export const SERVER_HEALTH_EXCLUSION_PATTERN =
  /왜|원인|해결|방법|명령어|command|script|예측|트렌드|보고서|리포트|장애\s*보고서/i;
export const SERVER_DETAIL_PATTERN =
  /\b[a-z0-9]+(?:-[a-z0-9]+){1,}\b.{0,24}(상태|현황|자세|상세|health|status|detail|어때|알려)/i;
export const ACTION_NEEDED_PATTERN =
  /(?:지금|현재|당장|즉시).{0,32}(?:조치|대응|위험).{0,32}(?:필요|해야|대상|있|시급|서버)|(?:조치|대응).{0,16}(?:필요한|필요|대상|시급).{0,16}(?:서버|순위)|(?:서버|대상).{0,16}(?:조치|대응).{0,16}(?:필요|시급|우선순위|순위)|(?:가장\s*)?(?:위험한|위험도\s*높은).{0,24}(?:서버|대상|순위)|(?:어떤|어느|무슨)?\s*(?:서버|대상).{0,24}(?:가장\s*)?(?:위험한|위험도\s*높은)|문제\s*(?:있는|가\s*있는|있\s*는)\s*(?:서버|대상|시스템)|(?:서버|대상|시스템).{0,20}문제\s*(?:있|가\s*있)|이상\s*(?:있는|이\s*있는)\s*(?:서버|대상)|비정상\s*(?:서버|대상|인\s*서버)|장애\s*(?:있는|가\s*있는)\s*(?:서버|대상)|immediate\s+action|urgent\s+action|action\s+needed|most\s+at\s+risk|problematic\s+servers?|faulty\s+servers?|unhealthy\s+servers?/i;
export const HEALTHY_ONLY_PATTERN =
  /정상\s*범위|이상\s*없는|문제\s*없는|괜찮은\s*서버|정상.{0,12}서버|healthy|normal|ok\s+servers?/i;
export const HEALTHY_ONLY_EXCLUSION_PATTERN =
  /비정상|문제\s*있는|위험|경고|warning|critical|offline|장애|포화|병목/i;
export const COMPOSITE_LOAD_RANKING_PATTERN =
  /(?:부하|로드|\bload\b).{0,24}(?:가장\s*)?(?:낮|적|최저|여유|한가)|(?:가장\s*)?(?:낮|적|최저|여유|한가).{0,24}(?:부하|로드|\bload\b)|여유\s*있는\s*서버|한가한\s*서버|available\s+servers?/i;
export const COMPOSITE_PRESSURE_RANKING_PATTERN =
  /(?:리소스|자원|resource|resources?|메트릭|지표|metric|metrics?|부하|로드|\bload\b).{0,40}(?:압박|부담|포화|심한|높|많|상위|순위|랭킹|ranking|rank|top|pressure|stress|saturation)|(?:압박|부담|포화|pressure|stress|saturation).{0,40}(?:리소스|자원|resource|resources?|서버|호스트|상위|순위|랭킹|ranking|rank|top)|(?:가장\s*)?(?:버거운|힘든).{0,24}(?:서버|호스트|대상)/i;
export const CURRENT_METRIC_GROUP_PATTERN =
  /(?:\b(?:db|database|web|cache|storage|lb|loadbalancer|mysql|redis|nfs|was|api|app|application|backend)\b|로드\s*밸런서|캐시|스토리지|저장소|웹|디비|데이터베이스|애플리케이션)\s*(서버|그룹)?/i;
export const METRIC_TREND_PATTERN =
  /추이|추세|트렌드|trend|변화|변동|(?:계속|지속|꾸준히|점점).{0,20}(?:올라|내려|높아|낮아|증가|감소|상승|하락|늘어|줄어)|(?:올라가|내려가).{0,8}(?:고\s*있|는\s*서버)|(?:상승|하락|증가|감소)\s*(?:중|추세|경향)/i;
export const GENERIC_METRIC_TREND_PATTERN =
  /메트릭|지표|리소스|resource|metrics?/i;
export const GROUP_SERVER_LIST_PATTERN =
  /서버\s*(?:들|목록|리스트)|호스트\s*(?:목록|리스트)?|목록|리스트|보여|알려|나열|show|list|servers?|hosts?|instances?|nodes?/i;
export const SERVER_ID_PATTERN = /\b[a-z][a-z0-9]+(?:-[a-z0-9]+){2,}\b/gi;
export const CONTEXTUAL_FOLLOW_UP_PATTERN =
  /방금|직전|이전|앞서|위\s*(?:결과|답변|내용)|방금\s*분석한|분석한\s*서버\s*중|방금\s*본|앞에서\s*본|(?:그|해당|이|위)\s*(?:서버|대상|호스트|노드)\s*(?:들|중|만|의)?/i;
export const MAX_CONTEXTUAL_SERVER_TARGETS = 12;
export const CONTEXTUAL_TOP_N_PATTERN =
  /(?:상위|하위|top|bottom)\s*(\d{1,2})|(?:가장|최고|최저|높|낮|많|적).{0,24}(\d{1,2})\s*(?:대|개)|(\d{1,2})\s*(?:대|개).{0,24}(?:상위|하위|top|bottom|가장|높|낮|많|적|랭킹|순위)/i;
export const RANKED_SERVER_LINE_PATTERN =
  /^\s*(?:\d{1,2}[.)]|[-*])\s*([a-z][a-z0-9]+(?:-[a-z0-9]+){2,})\b/gim;
export const SERVER_COMPARISON_CONNECTOR_PATTERN =
  /\bvs\.?\b|versus|비교|대비|차이|와|과|\band\b/i;
export const TIME_SERIES_COMPARISON_PATTERN =
  /(지난\s*\d|최근\s*\d|24\s*시간|하루|어제|last\s+\d|last24h|past\s+\d|평균|avg|추세|트렌드|trend|예측|forecast|변화)/i;
export const DEFAULT_TREND_METRICS: SupportedMetric[] = [
  'cpu',
  'memory',
  'disk',
];
export const GROUP_TARGET_HINTS = [
  {
    target: 'cache',
    pattern: /(?:캐시|cache|redis)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'storage',
    pattern: /(?:스토리지|저장소|storage|nfs|s3gw)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'web',
    pattern: /(?:웹|web|nginx)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'application',
    pattern:
      /(?:\b(?:was|api|app|backend|application)\b|애플리케이션)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'database',
    pattern: /(?:db|database|mysql|디비|데이터베이스)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'loadbalancer',
    pattern:
      /(?:로드\s*밸런서|로드밸런서|load\s*balancer|loadbalancer|lb)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'backup',
    pattern: /(?:백업|backup)\s*(?:서버|그룹)?/i,
  },
] as const;
