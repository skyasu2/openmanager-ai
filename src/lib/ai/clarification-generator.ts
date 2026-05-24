/**
 * Clarification Generator
 *
 * 모호한 쿼리에 대해 명확화 질문을 생성합니다.
 * Best Practice: 명확화 다이얼로그로 성공률 67% → 91% 향상 가능
 */

import {
  ENTITY_CONFIDENCE_THRESHOLD,
  type ExtractedEntities,
} from './entity-extractor';
import type { QueryClassification } from './query-classifier';
import { needsClarification } from './query-classifier';
import { hasExplicitServerReference } from './server-scope-detection';
import { isFormattingOnlyRequest } from './utils/query-complexity';

export interface ClarificationOption {
  id: string;
  text: string;
  suggestedQuery: string;
  category: 'specificity' | 'timerange' | 'scope' | 'custom';
}

export interface ClarificationRequest {
  originalQuery: string;
  options: ClarificationOption[];
  reason: string;
}

// 서버 관련 명확화 패턴
const SERVER_PATTERNS = {
  missing: /서버|server|상태|status|확인|check/i,
  hasSpecific:
    /web-\d+|db-\d+|api-\d+|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat|was|api|app|application|backend|애플리케이션|캐시|cache|스토리지|저장소|storage|nfs|s3/i,
};

const MAX_CLARIFICATION_OPTIONS = 6;

// 구체적 조건 패턴 (숫자 조건, 정렬, 필터링이 있으면 이미 구체적)
const SPECIFIC_CONDITION_PATTERNS = {
  // 숫자 조건: "92%", "3개", "TOP 5" (퍼센트 단독으로도 구체적 조건으로 인정)
  numericCondition: /\d+%|top\s*\d+|\d+개|상위\s*\d+|하위\s*\d+/i,
  // 상태 조건: "경고 상태인", "정상인", "오프라인", "다운된"
  statusCondition:
    /경고\s*(상태)?인|정상인|오프라인|다운|critical|warning|online|offline|down/i,
  // 비교 조건: "가장 높은", "가장 부하가 높았던", "높아", "최대", "최소"
  comparisonCondition:
    /(?:가장|제일).{0,24}(?:높|낮|많|적)|높[은아으았]|낮[은아으았]|많[은아으았]|적[은어으었]|최대|최소|highest|lowest|most|least/i,
  // 피크/최댓값 질의: peak/load1/max처럼 특정 집계 의도가 있으면 서버명 없이도 전체 집계 질의로 실행 가능
  peakIntent: /\b(?:peak|max)\b|피크|최고점|최댓값/i,
  // 필터 의도: "CPU 높은 서버 찾아줘", "메모리 많이 쓰는 서버 보여줘"
  filterIntent:
    /(?:cpu|메모리|디스크|memory|disk).+(?:찾아|알려|보여|목록)|(?:찾아|알려|보여).+(?:cpu|메모리|디스크|memory|disk)/i,
  // 명확화 선택으로 생성된 쿼리 접미사 (재명확화 방지)
  clarifiedSuffix:
    /\(전체 서버\)|\(web-server 그룹\)|\(db-server 그룹\)|\(loadbalancer 그룹\)|\(cache 그룹\)|\(storage 그룹\)|\(최근 \d+시간\)|\(최근 24시간\)|\(지난 7일\)/i,
  // 명시적 스코프: "모든 서버", "전체 서버" 등 스코프가 명확한 쿼리
  explicitScope:
    /모든\s*(서버|server)|전체\s*(서버|server|시스템|system)|서버명\s*없이|전부|all\s*(서버|server|systems?)|whole\s*(fleet|system)/i,
  // 명시적 서버 그룹: "WAS 서버들", "캐시 서버"처럼 단일 서버 ID는 없어도 scope가 분명한 질의
  groupScope:
    /(?:\b(?:was|api|app|application|backend|web|db|database|mysql|redis|cache|storage|nfs|lb|loadbalancer)\b|애플리케이션|캐시|스토리지|저장소|웹|디비|데이터베이스|로드\s*밸런서)\s*(?:서버|서버들|그룹|servers?|hosts?|instances?|nodes?)/i,
  // 전체 서버 탐색 의도: 특정 서버명이 없어도 fleet scan으로 실행 가능
  fleetScanIntent:
    /(?:조치|대응|확인).{0,16}필요.{0,16}서버|서버.{0,16}(?:조치|대응|확인).{0,16}필요|문제.{0,12}있는.{0,12}서버|위험.{0,12}서버|경고.{0,12}서버|장애.{0,12}서버|당장.{0,12}서버/i,
  // 대화 후속 참조: 직전 응답/분석 대상이 scope를 제공하므로 추가 서버 clarification을 피한다.
  followUpContextReference:
    /(?:방금|직전|이전|앞서|위에서|최근).{0,20}(?:분석|확인|언급|답변|본|살펴본)|(?:그중|그\s*중|이\s*중|중에서).{0,20}(?:골라|추려|필터|보여|알려)/i,
};

// 시간 관련 명확화 패턴
const TIME_PATTERNS = {
  missing: /추이|변화|기록|history|trend|최근|과거/i,
  hasSpecific: /\d+시간|\d+일|\d+분|지난|어제|오늘|이번\s*주|이번\s*달/i,
};

// 메트릭 관련 명확화 패턴
const METRIC_PATTERNS = {
  missing: /성능|문제|이상|느려|slow|issue|problem/i,
  hasSpecific:
    /cpu|memory|메모리|disk|디스크|network|네트워크|latency|응답|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat/i,
};

const EXTERNAL_KNOWLEDGE_PATTERNS =
  /최신|latest|stable|공식\s*문서|documentation|docs|릴리스|release|버전|version|cve|security\s*advisory|보안\s*취약점|next\.?js|react|vercel|node\.?js/i;

const INTERNAL_KNOWLEDGE_PATTERNS =
  /rag|내부\s*(문서|근거|지식)|사내\s*(문서|근거|지식)|프로젝트\s*(문서|파일|경로|위치)|저장소\s*(문서|파일|경로|위치)|repo(?:sitory)?\s*(doc|file|path|location)|ssot|single\s*source\s*of\s*truth|pre-generated|파일\s*경로|코드\s*위치|데이터\s*로더|data\s*loader|otel\s*(데이터|data)?\s*(파일|경로|위치|ssot)/i;

const OPERATIONS_COMMAND_GUIDANCE_PATTERNS =
  /(?:haproxy|nginx|mysql|redis|nfs|access\.log|slow_query|show\s+(?:stat|processlist|replica|slave)\s+status|redis-cli|showmount|findmnt|mount\s+-t|df\s+-h|awk|grep).*(?:명령어|방법|순서|확인|분석|재마운트)|(?:명령어|방법|순서|확인|분석|재마운트).*(?:haproxy|nginx|mysql|redis|nfs|access\.log|slow_query|show\s+(?:stat|processlist|replica|slave)\s+status|redis-cli|showmount|findmnt|mount\s+-t|df\s+-h|awk|grep)/i;

/**
 * 쿼리가 이미 구체적인 조건을 포함하는지 확인
 */
function hasSpecificConditions(query: string): boolean {
  return (
    SPECIFIC_CONDITION_PATTERNS.numericCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.statusCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.comparisonCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.peakIntent.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.filterIntent.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.clarifiedSuffix.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.explicitScope.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.groupScope.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.fleetScanIntent.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.followUpContextReference.test(query)
  );
}

function hasTrustedEntity(
  entities: ExtractedEntities | undefined,
  key: 'server' | 'metric' | 'timeRange'
): boolean {
  return Boolean(
    entities?.[key] && entities.confidence >= ENTITY_CONFIDENCE_THRESHOLD
  );
}

function getTrustedIntentFrame(entities: ExtractedEntities | undefined) {
  const frame = entities?.intentFrame;
  if (
    !frame ||
    frame.domain !== 'monitoring' ||
    frame.confidence < ENTITY_CONFIDENCE_THRESHOLD
  ) {
    return null;
  }

  return frame;
}

function hasTrustedWholeFleetScope(
  entities: ExtractedEntities | undefined
): boolean {
  const frame = getTrustedIntentFrame(entities);
  return Boolean(
    frame &&
      frame.scope === 'whole_fleet' &&
      frame.intent !== 'unknown' &&
      frame.ambiguity !== 'high'
  );
}

function hasTrustedIntentMetric(
  entities: ExtractedEntities | undefined
): boolean {
  const frame = getTrustedIntentFrame(entities);
  return Boolean(frame && frame.metric !== 'unknown');
}

function hasTrustedIntentTimeWindow(
  entities: ExtractedEntities | undefined
): boolean {
  const frame = getTrustedIntentFrame(entities);
  return Boolean(frame && frame.timeWindow !== 'unknown');
}

/**
 * 쿼리 분석 결과를 바탕으로 명확화가 필요한지 판단하고 옵션 생성
 */
export function generateClarification(
  query: string,
  classification: QueryClassification,
  entities?: ExtractedEntities
): ClarificationRequest | null {
  if (isFormattingOnlyRequest(query)) {
    return null;
  }

  if (EXTERNAL_KNOWLEDGE_PATTERNS.test(query)) {
    return null;
  }

  if (INTERNAL_KNOWLEDGE_PATTERNS.test(query)) {
    return null;
  }

  if (OPERATIONS_COMMAND_GUIDANCE_PATTERNS.test(query)) {
    return null;
  }

  if (hasExplicitServerReference(query)) {
    return null;
  }

  // LLM entity extraction으로 서버가 이미 특정된 경우 명확화 불필요
  if (hasTrustedEntity(entities, 'server')) {
    return null;
  }

  // 명확화가 필요하지 않으면 null 반환
  if (
    !needsClarification(classification.confidence, classification.complexity)
  ) {
    return null;
  }

  // 구체적 조건(숫자, 상태, 비교)이 있으면 명확화 불필요
  if (hasSpecificConditions(query)) {
    return null;
  }

  const options: ClarificationOption[] = [];
  const reasons: string[] = [];

  // 1. 서버 명시 필요 여부 체크
  if (
    SERVER_PATTERNS.missing.test(query) &&
    !SERVER_PATTERNS.hasSpecific.test(query) &&
    !hasExplicitServerReference(query) &&
    !hasTrustedEntity(entities, 'server') &&
    !hasTrustedWholeFleetScope(entities)
  ) {
    reasons.push('특정 서버가 명시되지 않음');
    options.push(
      {
        id: 'server-all',
        text: '전체 서버 현황',
        suggestedQuery: `${query} (전체 서버)`,
        category: 'scope',
      },
      {
        id: 'server-web',
        text: 'Web 서버만',
        suggestedQuery: `${query} (web-server 그룹)`,
        category: 'specificity',
      },
      {
        id: 'server-db',
        text: 'DB 서버만',
        suggestedQuery: `${query} (db-server 그룹)`,
        category: 'specificity',
      },
      {
        id: 'server-lb',
        text: '로드밸런서만',
        suggestedQuery: `${query} (loadbalancer 그룹)`,
        category: 'specificity',
      },
      {
        id: 'server-cache',
        text: '캐시 서버만',
        suggestedQuery: `${query} (cache 그룹)`,
        category: 'specificity',
      },
      {
        id: 'server-storage',
        text: '스토리지 서버만',
        suggestedQuery: `${query} (storage 그룹)`,
        category: 'specificity',
      }
    );
  }

  // 2. 시간 범위 필요 여부 체크
  if (
    TIME_PATTERNS.missing.test(query) &&
    !TIME_PATTERNS.hasSpecific.test(query) &&
    !hasTrustedEntity(entities, 'timeRange') &&
    !hasTrustedIntentTimeWindow(entities)
  ) {
    reasons.push('시간 범위가 명시되지 않음');
    options.push(
      {
        id: 'time-1h',
        text: '최근 1시간',
        suggestedQuery: `${query} (최근 1시간)`,
        category: 'timerange',
      },
      {
        id: 'time-24h',
        text: '최근 24시간',
        suggestedQuery: `${query} (최근 24시간)`,
        category: 'timerange',
      },
      {
        id: 'time-7d',
        text: '지난 7일',
        suggestedQuery: `${query} (지난 7일)`,
        category: 'timerange',
      }
    );
  }

  // 3. 메트릭 유형 필요 여부 체크
  if (
    METRIC_PATTERNS.missing.test(query) &&
    !METRIC_PATTERNS.hasSpecific.test(query) &&
    !hasTrustedEntity(entities, 'metric') &&
    !hasTrustedIntentMetric(entities)
  ) {
    reasons.push('확인할 메트릭이 명시되지 않음');
    options.push(
      {
        id: 'metric-cpu',
        text: 'CPU 사용률',
        suggestedQuery: `${query} CPU 사용률`,
        category: 'specificity',
      },
      {
        id: 'metric-memory',
        text: '메모리 사용률',
        suggestedQuery: `${query} 메모리 사용률`,
        category: 'specificity',
      },
      {
        id: 'metric-all',
        text: '전체 메트릭 요약',
        suggestedQuery: `${query} 전체 리소스 현황`,
        category: 'scope',
      }
    );
  }

  // 4. 인텐트별 추가 명확화
  if (classification.localIntent === 'analysis' && options.length < 2) {
    options.push({
      id: 'analysis-root-cause',
      text: '근본 원인 분석',
      suggestedQuery: `${query}의 근본 원인을 분석해줘`,
      category: 'specificity',
    });
  }

  // 5. 매우 짧은 쿼리에 대한 일반 명확화
  if (query.length < 10 && options.length === 0) {
    reasons.push('쿼리가 너무 짧음');
    options.push(
      {
        id: 'short-status',
        text: '서버 상태 확인',
        suggestedQuery: '전체 서버 상태를 요약해줘',
        category: 'custom',
      },
      {
        id: 'short-alert',
        text: '현재 알림 확인',
        suggestedQuery: '현재 활성화된 알림이 있어?',
        category: 'custom',
      },
      {
        id: 'short-help',
        text: '도움말 보기',
        suggestedQuery: '무엇을 도와드릴까요?',
        category: 'custom',
      }
    );
  }

  // 옵션이 없으면 명확화 불필요
  if (options.length === 0) {
    return null;
  }

  const limitedOptions = options.slice(0, MAX_CLARIFICATION_OPTIONS);

  return {
    originalQuery: query,
    options: limitedOptions,
    reason:
      reasons.length > 0
        ? reasons.join(', ')
        : `신뢰도 ${classification.confidence}%로 추가 정보가 필요합니다`,
  };
}

/**
 * 사용자가 선택한 명확화 옵션으로 쿼리 업데이트
 */
export function applyClarification(option: ClarificationOption): string {
  return option.suggestedQuery;
}

/**
 * 커스텀 명확화 입력 처리
 */
export function applyCustomClarification(
  originalQuery: string,
  customInput: string
): string {
  return `${originalQuery} - ${customInput}`;
}
