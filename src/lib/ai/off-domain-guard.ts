import { hasExplicitServerReference } from './server-scope-detection';

export type OffDomainGuardCategory =
  | 'live_fact'
  | 'external_action'
  | 'local_recommendation'
  | 'personal_general'
  | 'personal_experience'
  | 'employment_policy'
  | 'politics'
  | 'ethics'
  | 'general_coding';

export type OffDomainGuardAction = 'block' | 'warn';

export interface OffDomainGuardrailResult {
  category: OffDomainGuardCategory;
  action: OffDomainGuardAction;
  shouldShortCircuit?: true;
  warning: string;
  response?: string;
}

const OFF_DOMAIN_WARNING =
  '서버 운영·모니터링 범위를 벗어난 질문이라 답변 정확도가 낮을 수 있습니다.';
const GENERAL_IT_WARNING =
  '일반 IT 지식 답변이며 OpenManager 모니터링 데이터와 운영 도구는 사용하지 않았습니다.';

const OPERATIONAL_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|장애|알림|로그|오류|에러|토폴로지|아키텍처|구성도|배치도|운영|점검|명령어|cpu|씨피유|메모리|메머리|멤|디스크|용량|트래픽|네트워크|지연|응답|latency|response|server|servr|sever|infra|monitoring|incident|alert|log|memory|memroy|disk|traffic|network|load|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat|database|\bdb\b|promql|otel|runbook|krl|rag/i;

const NEGATED_OPERATIONAL_CONTEXT_PATTERN =
  /(?:서버|서벼|썹|인프라|시스템|시스탬|모니터링|장애|알림|로그|오류|에러|토폴로지|아키텍처|구성도|배치도|운영|점검|명령어|cpu|씨피유|메모리|메머리|멤|디스크|용량|트래픽|네트워크|지연|응답|server|servr|sever|infra|monitoring|incident|alert|log|memory|disk|traffic|network|load|mysql|nginx|redis|haproxy|postgres|mariadb|apache|kafka|elasticsearch|mongo|tomcat|database|\bdb\b|promql|otel|runbook|krl|rag)(?:\s*(?:상태|현황|정보|문맥|컨텍스트|내용|관련))?\s*(?:은|는|이|가|을|를)?\s*(?:말고|말구|제외(?:하고|한)?|빼고|대신|아니고|아닌)/i;

const EXTERNAL_ACTION_PATTERN =
  /((캘린더|calendar|일정|회의|미팅).*(잡아|등록|추가|넣어|만들어|생성|예약|schedule))|(예약해|예약\s*(잡아|잡|해줘|해)|\bbook\b|\breserve\b)|(메일|이메일|email|문자|sms|슬랙|slack).*(보내|발송|전송|공유|send)/i;

// 실시간 단독 키워드는 제외한다. "이 데이터 실시간이야?"처럼 시스템 데이터
// 신선도를 묻는 메타질문까지 외부 라이브정보(날씨/환율)로 오분류하기 때문이다.
// 외부 라이브정보는 날씨/환율/시세/가격/현재가/코인 키워드로 충분히 식별된다.
const LIVE_FACT_PATTERN =
  /날씨|weather|뉴스|news|환율|exchange\s*rate|주가|stock\s*price|시세|비트코인|bitcoin|btc|코인|crypto|현재가|지금\s*(가격|얼마)|가격\s*(알려|찾아|조회)/i;

const LOCAL_RECOMMENDATION_PATTERN =
  /(맛집|restaurant|카페|cafe|병원|약국|장소|근처).*(추천|찾아|알려)|(추천).*(맛집|restaurant|카페|cafe|병원|약국|장소|근처)/i;

const PERSONAL_FINANCE_PATTERN =
  /투자\s*(조언|추천)|주식\s*(포트폴리오|추천|투자|리밸런싱)|포트폴리오\s*(리밸런싱|추천|자산\s*배분)|자산\s*배분|financial\s*advice|investment\s*(advice|recommendation|strategy)|portfolio\s*(rebalance|allocation)/i;

const AMBIGUOUS_PERSONAL_FINANCE_PATTERN =
  /투자\s*(전략|결론)|리밸런싱\s*(추천|조언)/i;

const OFF_DOMAIN_FINANCE_CONTEXT_PATTERN =
  /내\s*투자|나의\s*투자|개인\s*투자|재테크|자산\s*관리|주식|펀드|etf|코인|암호화폐|비트코인|부동산|연금|퇴직연금|isa|계좌|서버\s*상태\s*말고|운영\s*말고|인프라\s*말고|모니터링\s*말고/i;

const PERSONAL_GENERAL_PATTERN =
  /운세|horoscope|점심|저녁|아침|메뉴|뭐\s*먹|번역|translate|일정\s*정리/i;

const PERSONAL_EXPERIENCE_PATTERN =
  /(?:팀|직장|회사).{0,20}갈등|갈등.{0,20}(?:해결|경험)|(?:실제|직접).{0,12}(?:팀|직장|회사|프로젝트).{0,16}경험|star\s*(?:방식|형식).{0,24}(?:갈등|경험)/i;

const EMPLOYMENT_POLICY_PATTERN =
  /채용\s*(?:평가|정책|결정|공정성)|지원자\s*(?:평가|선발|채용)|인사\s*(?:평가|채용)|hiring\s*(?:assessment|decision|policy|fairness)/i;

// 정치: 선거/정당 등 운영 도메인에서도 쓰이는 모호어(선거=leader election,
// 정책=보안 정책, 정당=정당한)는 제외하고, 명백한 선거·당파·정치 견해 키워드로만 매칭한다.
const POLITICS_PATTERN =
  /대통령|대선|총선|지방선거|국회의원|여당|야당|정치인|지지\s*(?:정당|후보)|(?:어느|무슨|어떤)\s*정당|정치\s*(?:성향|견해|의견|입장)|president(?:ial)?\s*(?:election|candidate)|political\s*(?:party|opinion|stance|view)|who\s*(?:should\s*i\s*)?vote/i;

// 윤리: 'AI 윤리', '운영 윤리'처럼 도메인에서 쓰이는 '윤리' 단독어는 제외하고,
// 사회적·윤리적 논쟁 주제와 윤리적 판단 요청으로만 매칭한다.
const ETHICS_PATTERN =
  /낙태|사형\s*제도|안락사|존엄사|동성\s*(?:결혼|애)|성소수자|윤리적으로\s*(?:옳|그르|맞|틀|정당)|도덕적\s*(?:옳|그르|딜레마|판단)|abortion|euthanasia|death\s*penalty|same[-\s]?sex\s*marriage/i;

const NON_OPERATIONAL_SERVER_COMPONENT_PATTERN =
  /react.{0,24}server\s+components?|server\s+components?.{0,32}client\s+components?/i;

const GENERAL_CODING_TOPIC_PATTERN =
  /파이썬|python|자바스크립트|javascript|typescript|java|c\+\+|c#|golang|rust|react|server\s+components?|client\s+components?|leetcode|백준|프로그래머스|two\s*sum|fibonacci|피보나치|algorithm|알고리즘|코딩|코드/i;

const GENERAL_CODING_REQUEST_PATTERN =
  /짜줘|작성|만들|구현|풀어|풀어줘|생성|설명|차이|개념|원리|write|generate|implement|solve|explain|difference/i;

function hasOperationalContext(query: string): boolean {
  if (NON_OPERATIONAL_SERVER_COMPONENT_PATTERN.test(query)) {
    return false;
  }
  return (
    hasExplicitServerReference(query) || OPERATIONAL_CONTEXT_PATTERN.test(query)
  );
}

function isGeneralItKnowledgeRequest(query: string): boolean {
  if (hasOperationalContext(query)) {
    return false;
  }
  return (
    GENERAL_CODING_TOPIC_PATTERN.test(query) &&
    GENERAL_CODING_REQUEST_PATTERN.test(query)
  );
}

function isPersonalFinanceQuery(query: string): boolean {
  if (PERSONAL_FINANCE_PATTERN.test(query)) {
    return true;
  }
  if (!AMBIGUOUS_PERSONAL_FINANCE_PATTERN.test(query)) {
    return false;
  }
  if (OFF_DOMAIN_FINANCE_CONTEXT_PATTERN.test(query)) {
    return true;
  }
  return !hasOperationalContext(query);
}

function hasNegatedOperationalContext(query: string): boolean {
  return NEGATED_OPERATIONAL_CONTEXT_PATTERN.test(query);
}

function buildResponse(category: OffDomainGuardCategory): string {
  switch (category) {
    case 'live_fact':
      return [
        '실시간 외부 조회 도구가 연결되어 있지 않아 현재 가격, 날씨, 뉴스, 환율 같은 값을 확인할 수 없습니다.',
        '정확한 현재값은 공식 앱, 거래소, 기상청, 금융 정보 서비스에서 확인해 주세요.',
        '',
        'OpenManager 범위 안에서는 서버 CPU, 메모리, 디스크, 알림, 로그, 토폴로지, 장애 징후를 바로 분석할 수 있습니다.',
      ].join('\n');
    case 'external_action':
      return [
        '캘린더, 예약, 메일, 문자, Slack 같은 외부 시스템을 직접 실행할 수 없습니다.',
        '대신 아래처럼 사용자가 복사해서 등록하거나 보낼 수 있는 초안만 제공할 수 있습니다.',
        '',
        '- 제목: 요청하신 작업',
        '- 내용: 필요한 참석자, 시간, 장소, 목적을 확인한 뒤 외부 도구에서 직접 등록해 주세요.',
      ].join('\n');
    case 'local_recommendation':
      return [
        '최신 영업 여부, 위치, 대기 시간, 리뷰 데이터를 확인할 수 없습니다.',
        '장소 추천은 지도/리뷰 서비스에서 현재 정보를 확인해야 합니다.',
        '',
        '일반 기준으로는 접근성, 최근 리뷰, 영업시간, 혼잡도, 예산, 예약 가능 여부를 비교해 고르면 됩니다.',
      ].join('\n');
    case 'personal_general':
      return [
        '저는 서버 운영·모니터링 중심 AI라 이 질문은 지원 범위 밖입니다.',
        '운영 범위 안에서는 서버 상태, 장애 징후, 로그, 리소스 사용률, 조치 명령어를 근거와 함께 분석할 수 있습니다.',
      ].join('\n');
    case 'personal_experience':
      return '저는 실제 조직에서 일하거나 팀 갈등을 경험한 사람이 아니므로 실제 팀 경험을 답변할 수 없습니다.';
    case 'employment_policy':
      return [
        '해당 질문은 채용 평가와 공정성 정책에 관한 내용으로 OpenManager AI의 서버 운영·모니터링 지원 범위를 벗어납니다.',
        '저는 지원자 평가나 채용 정책에 대한 판단을 제공하지 않습니다.',
      ].join('\n');
    case 'politics':
      return [
        '저는 서버 운영·모니터링 중심 AI로, 선거·정당·정치 견해에 대한 판단이나 조언은 제공하지 않습니다.',
        '운영 범위 안에서는 서버 상태, 장애 징후, 로그, 리소스 사용률을 근거와 함께 분석할 수 있습니다.',
      ].join('\n');
    case 'ethics':
      return [
        '해당 질문은 사회적·윤리적 논쟁 주제로, 저는 특정 입장이나 도덕적 판단을 제공하지 않습니다.',
        '운영 범위 안에서는 서버 상태, 장애 징후, 로그, 리소스 사용률을 근거와 함께 분석할 수 있습니다.',
      ].join('\n');
    case 'general_coding':
      return [
        'OpenManager는 서버 운영·모니터링 중심 AI입니다.',
        '일반 알고리즘 풀이, 학습용 코드 완성, 범용 코딩 문제 해결은 지원 범위 밖입니다.',
        '',
        '다만 로그 파싱, 모니터링 자동화, 운영 점검 스크립트, PromQL, 장애 대응 runbook처럼 서버 운영과 직접 연결된 코드는 도울 수 있습니다.',
      ].join('\n');
  }
}

export function getOffDomainGuardrail(
  query: string
): OffDomainGuardrailResult | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  if (isPersonalFinanceQuery(trimmedQuery)) {
    return {
      category: 'personal_general',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('personal_general'),
    };
  }

  if (PERSONAL_EXPERIENCE_PATTERN.test(trimmedQuery)) {
    return {
      category: 'personal_experience',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('personal_experience'),
    };
  }

  if (EMPLOYMENT_POLICY_PATTERN.test(trimmedQuery)) {
    return {
      category: 'employment_policy',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('employment_policy'),
    };
  }

  if (
    hasNegatedOperationalContext(trimmedQuery) &&
    LIVE_FACT_PATTERN.test(trimmedQuery)
  ) {
    return {
      category: 'live_fact',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('live_fact'),
    };
  }

  if (
    hasNegatedOperationalContext(trimmedQuery) &&
    LOCAL_RECOMMENDATION_PATTERN.test(trimmedQuery)
  ) {
    return {
      category: 'local_recommendation',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('local_recommendation'),
    };
  }

  if (hasOperationalContext(trimmedQuery)) {
    return null;
  }

  // politics/ethics는 운영 맥락 게이트 '뒤에' 둔다. 선거일 트래픽 대응처럼
  // 정치/윤리 단어가 섞인 정상 운영 질문(예: "대선 당일 트래픽 스케일링",
  // "총선 개표 서버 CPU")을 오차단하지 않기 위함이다. 운영 맥락이 없는 순수
  // 정치/윤리 질문("너의 정치 성향은?")은 여기까지 내려와 그대로 차단된다.
  // ⚠️ 이 두 검사를 게이트 앞으로 되돌리면 운영 질문 오차단이 재발한다.
  if (POLITICS_PATTERN.test(trimmedQuery)) {
    return {
      category: 'politics',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('politics'),
    };
  }

  if (ETHICS_PATTERN.test(trimmedQuery)) {
    return {
      category: 'ethics',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('ethics'),
    };
  }

  if (EXTERNAL_ACTION_PATTERN.test(trimmedQuery)) {
    return {
      category: 'external_action',
      action: 'warn',
      warning: OFF_DOMAIN_WARNING,
    };
  }

  if (isGeneralItKnowledgeRequest(trimmedQuery)) {
    return {
      category: 'general_coding',
      action: 'warn',
      warning: GENERAL_IT_WARNING,
    };
  }

  if (LIVE_FACT_PATTERN.test(trimmedQuery)) {
    return {
      category: 'live_fact',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('live_fact'),
    };
  }

  if (LOCAL_RECOMMENDATION_PATTERN.test(trimmedQuery)) {
    return {
      category: 'local_recommendation',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('local_recommendation'),
    };
  }

  if (PERSONAL_GENERAL_PATTERN.test(trimmedQuery)) {
    return {
      category: 'personal_general',
      action: 'block',
      shouldShortCircuit: true,
      warning: OFF_DOMAIN_WARNING,
      response: buildResponse('personal_general'),
    };
  }

  return null;
}
