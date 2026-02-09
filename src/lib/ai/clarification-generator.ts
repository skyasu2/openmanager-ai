/**
 * Clarification Generator
 *
 * 모호한 쿼리에 대해 명확화 질문을 생성합니다.
 * Best Practice: 명확화 다이얼로그로 성공률 67% → 91% 향상 가능
 */

import type { QueryClassification } from './query-classifier';
import { needsClarification } from './query-classifier';

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
    /[a-z]+-[a-z]+-\d+|server-?\d+|web-\d+|db-\d+|api-\d+|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat/i,
};

// 구체적 조건 패턴 (숫자 조건, 정렬, 필터링이 있으면 이미 구체적)
const SPECIFIC_CONDITION_PATTERNS = {
  // 숫자 조건: "92%", "3개", "TOP 5" (퍼센트 단독으로도 구체적 조건으로 인정)
  numericCondition: /\d+%|top\s*\d+|\d+개|상위\s*\d+|하위\s*\d+/i,
  // 상태 조건: "경고 상태인", "정상인", "오프라인", "다운된"
  statusCondition:
    /경고\s*(상태)?인|정상인|오프라인|다운|critical|warning|online|offline|down/i,
  // 비교 조건: "가장 높은", "제일 높은", "높아", "높으면", "최대", "최소"
  comparisonCondition:
    /(?:가장|제일)\s*(높|낮|많|적)|높[은아으]|낮[은아으]|많[은아으]|적[은어으]|최대|최소|highest|lowest|most|least/i,
  // 필터 의도: "CPU 높은 서버 찾아줘", "메모리 많이 쓰는 서버 보여줘"
  filterIntent:
    /(?:cpu|메모리|디스크|memory|disk).+(?:찾아|알려|보여|목록)|(?:찾아|알려|보여).+(?:cpu|메모리|디스크|memory|disk)/i,
  // 명확화 선택으로 생성된 쿼리 접미사 (재명확화 방지)
  clarifiedSuffix:
    /\(전체 서버\)|\(web-server 그룹\)|\(db-server 그룹\)|\(loadbalancer 그룹\)|\(cache 그룹\)|\(최근 \d+시간\)|\(최근 24시간\)|\(지난 7일\)/i,
  // 명시적 스코프: "모든 서버", "전체 서버" 등 스코프가 명확한 쿼리
  explicitScope:
    /모든\s*(서버|server)|전체\s*(서버|server)|전부|all\s*(서버|server)/i,
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

/**
 * 쿼리가 이미 구체적인 조건을 포함하는지 확인
 */
function hasSpecificConditions(query: string): boolean {
  return (
    SPECIFIC_CONDITION_PATTERNS.numericCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.statusCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.comparisonCondition.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.filterIntent.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.clarifiedSuffix.test(query) ||
    SPECIFIC_CONDITION_PATTERNS.explicitScope.test(query)
  );
}

/**
 * 쿼리 분석 결과를 바탕으로 명확화가 필요한지 판단하고 옵션 생성
 */
export function generateClarification(
  query: string,
  classification: QueryClassification
): ClarificationRequest | null {
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
    !SERVER_PATTERNS.hasSpecific.test(query)
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
      }
    );
  }

  // 2. 시간 범위 필요 여부 체크
  if (
    TIME_PATTERNS.missing.test(query) &&
    !TIME_PATTERNS.hasSpecific.test(query)
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
    !METRIC_PATTERNS.hasSpecific.test(query)
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
  if (classification.intent === 'analysis' && options.length < 2) {
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

  // 최대 4개 옵션으로 제한
  const limitedOptions = options.slice(0, 4);

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
