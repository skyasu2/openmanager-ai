/**
 * Security Pattern Constants
 *
 * Prompt Injection, XSS, 민감정보 탐지용 정규식 패턴
 *
 * @created 2026-02-10 (security.ts SRP 분리)
 * @updated 2026-01-11 - OWASP LLM Top 10 기반 패턴 추가
 * @updated 2025-12-30 - ReDoS 방지 및 XSS 필터 강화
 */

// ============================================================================
// 상수
// ============================================================================

export const MAX_INPUT_LENGTH = 10000;
export const MAX_OUTPUT_LENGTH = 50000;

// ============================================================================
// 민감 정보 패턴
// ============================================================================

/**
 * 민감 정보 패턴 (API 키, 토큰, 비밀번호 등)
 *
 * @security ReDoS 방지를 위해 값 부분을 `[^\s]{1,100}`으로 제한
 */
export const SENSITIVE_PATTERNS = [
  /(api[_-]?key|apikey)\s*[=:]\s*['"]?[^\s'"]{1,100}['"]?/gi,
  /(token|bearer)\s*[=:]\s*['"]?[^\s'"]{1,100}['"]?/gi,
  /(password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{1,100}['"]?/gi,
  /(secret|private[_-]?key)\s*[=:]\s*['"]?[^\s'"]{1,100}['"]?/gi,
  /(access[_-]?key|secret[_-]?key)\s*[=:]\s*['"]?[^\s'"]{1,100}['"]?/gi,
];

// ============================================================================
// Prompt Injection 패턴 (OWASP LLM Top 10)
// ============================================================================

/**
 * @security 다양한 Injection 시도 탐지
 * - 지시 무시 패턴 (영어/한국어/변형)
 * - 역할 변경 시도
 * - 시스템 프롬프트 노출 시도
 * - 탈옥 키워드
 * - 인코딩 우회 시도
 */
export const PROMPT_INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
}> = [
  // 지시 무시 패턴 (영어)
  {
    pattern:
      /ignore\s*(all\s*)?(previous|prior|above|system|your)\s*(instructions?|prompts?|rules?|commands?)/gi,
    name: 'ignore_instructions_en',
  },
  {
    pattern: /disregard\s*(all\s*)?(the\s*)?(previous|above|prior)/gi,
    name: 'disregard_instructions',
  },
  {
    pattern:
      /forget\s*(everything|all|your)\s*(previous|above|instructions?)/gi,
    name: 'forget_instructions',
  },

  // 지시 무시 패턴 (한국어)
  {
    pattern: /이전\s*(지시|명령|규칙|프롬프트).{0,10}(무시|잊어|무효|취소)/gi,
    name: 'ignore_instructions_ko',
  },
  {
    pattern: /(무시|잊어).{0,10}(이전|위|시스템|모든)\s*(지시|명령|규칙)/gi,
    name: 'ignore_instructions_ko_alt',
  },
  {
    pattern: /시스템\s*(지시|명령|규칙).{0,10}(무시|변경|무효화)/gi,
    name: 'system_instructions_ko',
  },

  // 역할 변경 시도
  {
    pattern:
      /you\s*are\s*(now|acting|playing)\s*(as|like)\s*(?!서버|모니터링|AI|assistant)/gi,
    name: 'role_change_en',
  },
  {
    pattern: /당신은\s*(이제|지금부터)\s*(?!서버|모니터링|AI|assistant)/gi,
    name: 'role_change_ko',
  },
  {
    pattern: /pretend\s*(to\s*be|you\s*are|that\s*you)/gi,
    name: 'pretend_role',
  },
  {
    pattern: /act\s*as\s*(if|though|a\s+different)/gi,
    name: 'act_as_role',
  },

  // 시스템 프롬프트 노출 시도
  {
    pattern:
      /show\s*(me\s*)?(your|the|system)\s*(prompt|instructions?|rules?)/gi,
    name: 'show_prompt_en',
  },
  {
    pattern: /시스템\s*프롬프트.{0,10}(알려|보여|출력|공개|말해)/gi,
    name: 'show_prompt_ko',
  },
  {
    pattern:
      /what\s*(are|is)\s*(your|the)\s*(instructions?|rules?|prompt|system)/gi,
    name: 'what_instructions',
  },
  {
    pattern: /reveal\s*(your|the)\s*(prompt|instructions?|system)/gi,
    name: 'reveal_prompt',
  },
  {
    pattern:
      /print\s*(your|the)\s*(prompt|instructions?|system|configuration)/gi,
    name: 'print_prompt',
  },

  // 탈옥 키워드
  {
    pattern: /jailbreak|jail\s*break/gi,
    name: 'jailbreak',
  },
  {
    pattern: /DAN\s*(mode)?|do\s*anything\s*now/gi,
    name: 'dan_mode',
  },
  {
    pattern: /developer\s*mode|sudo\s*mode|admin\s*mode/gi,
    name: 'special_mode',
  },
  {
    pattern: /bypass\s*(all\s*)?(restrictions?|filters?|safety)/gi,
    name: 'bypass_restrictions',
  },

  // 인코딩 우회 시도
  {
    pattern: /base64|atob\s*\(|btoa\s*\(/gi,
    name: 'encoding_bypass',
  },
  {
    pattern: /\\u[0-9a-f]{4}/gi,
    name: 'unicode_escape',
  },
  {
    pattern: /&#x?[0-9a-f]+;/gi,
    name: 'html_entity_escape',
  },
];

// ============================================================================
// 악성 출력 패턴 (AI 응답 검증용)
// ============================================================================

/**
 * @security AI가 Injection에 응했는지 탐지
 */
export const MALICIOUS_OUTPUT_PATTERNS: Array<{
  pattern: RegExp;
  name: string;
}> = [
  // 지시 무시 확인 응답
  {
    pattern: /understood.*ignore|i\s*will\s*(now\s*)?ignore/gi,
    name: 'confirm_ignore_en',
  },
  {
    pattern: /알겠습니다.{0,20}(지시|명령).{0,10}무시/gi,
    name: 'confirm_ignore_ko',
  },
  {
    pattern: /as\s*you\s*(requested|asked|instructed).{0,20}ignore/gi,
    name: 'as_requested_ignore',
  },

  // 시스템 정보 유출
  {
    pattern: /system\s*prompt\s*(is|:)|시스템\s*프롬프트(는|:)/gi,
    name: 'reveal_system_prompt',
  },
  {
    pattern: /my\s*instructions?\s*(are|is|:)/gi,
    name: 'reveal_instructions',
  },
  {
    pattern: /i\s*was\s*(told|instructed|programmed)\s*to/gi,
    name: 'reveal_programming',
  },

  // 역할 변경 확인
  {
    pattern: /i\s*am\s*(now|acting\s*as)\s*(?!서버|AI|assistant|모니터링)/gi,
    name: 'confirm_role_change_en',
  },
  {
    pattern: /as\s*DAN|developer\s*mode\s*enabled|admin\s*mode\s*activated/gi,
    name: 'confirm_special_mode',
  },
  {
    pattern:
      /sure,?\s*i('ll|\s*will)\s*(help\s*you\s*)?(bypass|ignore|break)/gi,
    name: 'confirm_bypass',
  },

  // 시스템 프롬프트 본문 유출 감지
  {
    pattern: /당신은 서버 모니터링 AI 어시스턴트/g,
    name: 'leak_system_prompt_ko',
  },
  {
    pattern: /You are a server monitoring AI assistant/gi,
    name: 'leak_system_prompt_en',
  },
  {
    pattern: /getServerMetrics.*filterServers.*buildIncidentTimeline/gs,
    name: 'leak_tool_list',
  },
];

// ============================================================================
// 위험 콘텐츠 패턴 (XSS, 코드 실행 등)
// ============================================================================

/**
 * @security 확장된 XSS 벡터 커버리지
 */
export const DANGEROUS_OUTPUT_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<[^>]+\s+on\w+\s*=/gi,
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /eval\s*\([^)]{0,500}\)/gi,
  /exec\s*\([^)]{0,500}\)/gi,
  /\.innerHTML\s*=/gi,
];

// ============================================================================
// HTML 이스케이프 매핑
// ============================================================================

export const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};
