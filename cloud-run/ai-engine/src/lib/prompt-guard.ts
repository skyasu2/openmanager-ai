/**
 * Prompt Injection Guard for Cloud Run AI Engine
 *
 * Vercel security.ts의 핵심 로직을 Cloud Run용으로 포팅.
 * OWASP LLM Top 10 기반 입력/출력 보안 필터.
 *
 * @created 2026-01-30
 */

import { logger } from './logger';

// ============================================================================
// Prompt Injection 패턴 (EN/KO)
// ============================================================================

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // 지시 무시 (영어)
  {
    pattern: /ignore\s*(all\s*)?(previous|prior|above|system|your)\s*(instructions?|prompts?|rules?|commands?)/gi,
    name: 'ignore_instructions_en',
  },
  {
    pattern: /disregard\s*(all\s*)?(the\s*)?(previous|above|prior)/gi,
    name: 'disregard_instructions',
  },
  {
    pattern: /forget\s*(everything|all|your)\s*(previous|above|instructions?)/gi,
    name: 'forget_instructions',
  },
  // 지시 무시 (한국어)
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
  // 역할 변경
  {
    pattern: /you\s*are\s*(now|acting|playing)\s*(as|like)\s*(?!서버|모니터링|AI|assistant)/gi,
    name: 'role_change_en',
  },
  {
    pattern: /pretend\s*(to\s*be|you\s*are|that\s*you)/gi,
    name: 'pretend_role',
  },
  {
    pattern: /act\s*as\s*(if|though|a\s+different)/gi,
    name: 'act_as_role',
  },
  // 시스템 프롬프트 노출
  {
    pattern: /show\s*(me\s*)?(your|the|system)\s*(prompt|instructions?|rules?)/gi,
    name: 'show_prompt_en',
  },
  {
    pattern: /시스템\s*프롬프트.{0,10}(알려|보여|출력|공개|말해)/gi,
    name: 'show_prompt_ko',
  },
  {
    pattern: /reveal\s*(your|the)\s*(prompt|instructions?|system)/gi,
    name: 'reveal_prompt',
  },
  {
    pattern: /print\s*(your|the)\s*(prompt|instructions?|system|configuration)/gi,
    name: 'print_prompt',
  },
  // 탈옥
  { pattern: /jailbreak|jail\s*break/gi, name: 'jailbreak' },
  { pattern: /DAN\s*(mode)?|do\s*anything\s*now/gi, name: 'dan_mode' },
  { pattern: /developer\s*mode|sudo\s*mode|admin\s*mode/gi, name: 'special_mode' },
  { pattern: /bypass\s*(all\s*)?(restrictions?|filters?|safety)/gi, name: 'bypass_restrictions' },
];

// ============================================================================
// 악성 출력 패턴
// ============================================================================

const MALICIOUS_OUTPUT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /understood.*ignore|i\s*will\s*(now\s*)?ignore/gi, name: 'confirm_ignore_en' },
  { pattern: /알겠습니다.{0,20}(지시|명령).{0,10}무시/gi, name: 'confirm_ignore_ko' },
  { pattern: /as\s*you\s*(requested|asked|instructed).{0,20}ignore/gi, name: 'as_requested_ignore' },
  { pattern: /system\s*prompt\s*(is|:)|시스템\s*프롬프트(는|:)/gi, name: 'reveal_system_prompt' },
  { pattern: /my\s*instructions?\s*(are|is|:)/gi, name: 'reveal_instructions' },
  { pattern: /i\s*was\s*(told|instructed|programmed)\s*to/gi, name: 'reveal_programming' },
  { pattern: /i\s*am\s*(now|acting\s*as)\s*(?!서버|AI|assistant|모니터링)/gi, name: 'confirm_role_change_en' },
  { pattern: /as\s*DAN|developer\s*mode\s*enabled|admin\s*mode\s*activated/gi, name: 'confirm_special_mode' },
  { pattern: /sure,?\s*i('ll|\s*will)\s*(help\s*you\s*)?(bypass|ignore|break)/gi, name: 'confirm_bypass' },
  // 시스템 프롬프트 본문 유출 감지
  { pattern: /당신은 서버 모니터링 AI 어시스턴트/g, name: 'leak_system_prompt_ko' },
  { pattern: /You are a server monitoring AI assistant/gi, name: 'leak_system_prompt_en' },
  { pattern: /getServerMetrics.*filterServers.*buildIncidentTimeline/gs, name: 'leak_tool_list' },
];

// ============================================================================
// 탐지 함수
// ============================================================================

type RiskLevel = 'none' | 'low' | 'medium' | 'high';

interface InjectionDetectionResult {
  isInjection: boolean;
  patterns: string[];
  riskLevel: RiskLevel;
}

export function detectPromptInjection(text: string): InjectionDetectionResult {
  const detected: string[] = [];

  for (const { pattern, name } of PROMPT_INJECTION_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(text)) {
      detected.push(name);
    }
  }

  let riskLevel: RiskLevel = 'none';
  if (detected.length > 0) {
    const hasHigh = detected.some(
      (p) => p.includes('jailbreak') || p.includes('dan_mode') || p.includes('bypass') || p.includes('special_mode')
    );
    const hasMedium = detected.some(
      (p) => p.includes('ignore') || p.includes('disregard') || p.includes('forget') || p.includes('reveal') || p.includes('show_prompt')
    );

    if (hasHigh || detected.length >= 3) riskLevel = 'high';
    else if (hasMedium || detected.length >= 2) riskLevel = 'medium';
    else riskLevel = 'low';
  }

  return { isInjection: detected.length > 0, patterns: detected, riskLevel };
}

// ============================================================================
// 정제 함수
// ============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeForPrompt(text: string): string {
  const MAX_LENGTH = 10000;
  let sanitized = text.length > MAX_LENGTH ? text.slice(0, MAX_LENGTH) : text;

  for (const { pattern } of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(pattern.source, pattern.flags), '[blocked]');
  }

  return escapeXml(sanitized);
}

// ============================================================================
// 출력 필터
// ============================================================================

export function filterMaliciousOutput(text: string): string {
  for (const { pattern } of MALICIOUS_OUTPUT_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(text)) {
      logger.warn({ text: text.slice(0, 100) }, 'PromptGuard: malicious output detected');
      return '죄송합니다. 해당 요청에 응답할 수 없습니다. 서버 모니터링 관련 질문을 해주세요.';
    }
  }
  return text;
}

// ============================================================================
// 통합 가드 함수
// ============================================================================

interface GuardResult {
  sanitizedQuery: string;
  shouldBlock: boolean;
  riskLevel: RiskLevel;
  patterns: string[];
  warning?: string;
}

export function applySanitizedQueryToMessages<
  T extends { role: string; content: string }
>(messages: T[], sanitizedQuery: string): T[] {
  if (!sanitizedQuery) {
    return messages;
  }

  let targetIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (
      messages[i]?.role === 'user' &&
      typeof messages[i]?.content === 'string' &&
      messages[i].content.trim().length > 0
    ) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    return messages;
  }

  return messages.map((message, index) =>
    index === targetIndex ? { ...message, content: sanitizedQuery } : message
  );
}

export function guardInput(query: string): GuardResult {
  const detection = detectPromptInjection(query);
  const sanitizedQuery = sanitizeForPrompt(query);
  // medium 이상 차단 (prompt injection 방어 강화)
  const shouldBlock =
    detection.riskLevel === 'high' || detection.riskLevel === 'medium';

  if (detection.isInjection) {
    logger.warn(
      { riskLevel: detection.riskLevel, patterns: detection.patterns, shouldBlock },
      'PromptGuard: injection detected'
    );
  }

  const warning = detection.isInjection
    ? `보안 경고: Prompt Injection 시도가 감지되어 차단되었습니다 (${detection.patterns.join(', ')}).`
    : undefined;

  return {
    sanitizedQuery,
    shouldBlock,
    riskLevel: detection.riskLevel,
    patterns: detection.patterns,
    warning,
  };
}
