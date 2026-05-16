export type OffDomainGuardCategory =
  | 'live_fact'
  | 'external_action'
  | 'local_recommendation'
  | 'personal_general'
  | 'general_coding';

export interface OffDomainGuardrailResult {
  category: OffDomainGuardCategory;
  /** Warning message to prepend before the LLM response. No blocking. */
  offDomainWarning: string;
}

const OFF_DOMAIN_WARNING =
  '서버 모니터링 외 질문으로 답변 정확도가 낮을 수 있습니다.';

const OPERATIONAL_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|장애|알림|로그|오류|에러|토폴로지|아키텍처|구성도|배치도|운영|점검|명령어|cpu|씨피유|메모리|메머리|멤|디스크|용량|트래픽|네트워크|지연|응답|latency|response|server|servr|sever|infra|monitoring|incident|alert|log|memory|memroy|disk|traffic|network|load|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat|database|\bdb\b|promql|otel|runbook|krl|rag/i;

const SERVER_ID_PATTERN =
  /\b(?:lb|web|api|was|db|cache|storage|backup|monitoring|worker)-[a-z0-9-]+/i;

const EXTERNAL_ACTION_PATTERN =
  /((캘린더|calendar|일정|회의|미팅).*(잡아|등록|추가|넣어|만들어|생성|예약|schedule))|(예약해|예약\s*(잡아|잡|해줘|해)|\bbook\b|\breserve\b)|(메일|이메일|email|문자|sms|슬랙|slack).*(보내|발송|전송|공유|send)/i;

const LIVE_FACT_PATTERN =
  /날씨|weather|뉴스|news|환율|exchange\s*rate|주가|stock\s*price|시세|비트코인|bitcoin|btc|코인|crypto|현재가|지금\s*(가격|얼마)|가격\s*(알려|찾아|조회)|실시간/i;

const LOCAL_RECOMMENDATION_PATTERN =
  /(맛집|restaurant|카페|cafe|병원|약국|장소|근처).*(추천|찾아|알려)|(추천).*(맛집|restaurant|카페|cafe|병원|약국|장소|근처)/i;

const PERSONAL_GENERAL_PATTERN =
  /운세|horoscope|점심|저녁|아침|메뉴|뭐\s*먹|번역|translate|일정\s*정리/i;

const GENERAL_CODING_TOPIC_PATTERN =
  /파이썬|python|자바스크립트|javascript|typescript|java|c\+\+|c#|golang|rust|leetcode|백준|프로그래머스|two\s*sum|fibonacci|피보나치|algorithm|알고리즘|코딩|코드/i;

const GENERAL_CODING_REQUEST_PATTERN =
  /짜줘|작성|만들|구현|풀어|풀어줘|생성|write|generate|implement|solve/i;

function hasOperationalContext(query: string): boolean {
  return SERVER_ID_PATTERN.test(query) || OPERATIONAL_CONTEXT_PATTERN.test(query);
}

function isGeneralCodingRequest(query: string): boolean {
  return (
    GENERAL_CODING_TOPIC_PATTERN.test(query) &&
    GENERAL_CODING_REQUEST_PATTERN.test(query)
  );
}

export function getOffDomainGuardrail(
  query: string
): OffDomainGuardrailResult | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  if (hasOperationalContext(trimmedQuery)) {
    return null;
  }

  if (EXTERNAL_ACTION_PATTERN.test(trimmedQuery)) {
    return { category: 'external_action', offDomainWarning: OFF_DOMAIN_WARNING };
  }

  if (isGeneralCodingRequest(trimmedQuery)) {
    return { category: 'general_coding', offDomainWarning: OFF_DOMAIN_WARNING };
  }

  if (LIVE_FACT_PATTERN.test(trimmedQuery)) {
    return { category: 'live_fact', offDomainWarning: OFF_DOMAIN_WARNING };
  }

  if (LOCAL_RECOMMENDATION_PATTERN.test(trimmedQuery)) {
    return { category: 'local_recommendation', offDomainWarning: OFF_DOMAIN_WARNING };
  }

  if (PERSONAL_GENERAL_PATTERN.test(trimmedQuery)) {
    return { category: 'personal_general', offDomainWarning: OFF_DOMAIN_WARNING };
  }

  return null;
}
