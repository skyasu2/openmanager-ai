/**
 * Unified Stream Security Module
 * 경량화된 입력/출력 보안 필터
 *
 * @description Cloud Run Multi-Agent API의 보안 레이어
 * - 입력: 길이 제한, 민감정보 마스킹, Prompt Injection 탐지
 * - 출력: 길이 제한, 잠재적 위험 콘텐츠 필터링, 악성 출력 탐지
 *
 * @updated 2026-02-10 - SRP 분리 (패턴 상수 → security-patterns.ts)
 * @updated 2026-01-11 - Prompt Injection 방어 강화
 * @updated 2025-12-30 - ReDoS 방지 및 XSS 필터 강화
 */

import {
  DANGEROUS_OUTPUT_PATTERNS,
  HTML_ESCAPE_MAP,
  MALICIOUS_OUTPUT_PATTERNS,
  MAX_INPUT_LENGTH,
  MAX_OUTPUT_LENGTH,
  PROMPT_INJECTION_PATTERNS,
  SENSITIVE_PATTERNS,
} from './security-patterns';

// ============================================================================
// 입력 검증 함수
// ============================================================================

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  modifications: string[];
}

/**
 * 사용자 입력을 검증하고 정제
 * - 길이 제한 적용
 * - 민감 정보 마스킹
 */
export function sanitizeInput(text: string): SanitizationResult {
  const modifications: string[] = [];
  let sanitized = text;

  // 1. 길이 제한
  if (sanitized.length > MAX_INPUT_LENGTH) {
    sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);
    modifications.push(`truncated_to_${MAX_INPUT_LENGTH}_chars`);
  }

  // 2. 민감 정보 마스킹
  for (const pattern of SENSITIVE_PATTERNS) {
    const before = sanitized;
    sanitized = sanitized.replace(pattern, '[REDACTED]');
    if (before !== sanitized) {
      modifications.push('sensitive_info_masked');
      break; // 한 번만 기록
    }
  }

  return {
    sanitized,
    wasModified: modifications.length > 0,
    modifications,
  };
}

// ============================================================================
// 출력 필터 함수
// ============================================================================

export interface FilterResult {
  filtered: string;
  wasFiltered: boolean;
  reasons: string[];
}

/**
 * AI 응답을 필터링
 * - 길이 제한 적용
 * - 위험 콘텐츠 제거
 */
export function filterResponse(text: string): FilterResult {
  const reasons: string[] = [];
  let filtered = text;

  // 1. 길이 제한
  if (filtered.length > MAX_OUTPUT_LENGTH) {
    filtered = `${filtered.slice(0, MAX_OUTPUT_LENGTH)}...[truncated]`;
    reasons.push(`truncated_to_${MAX_OUTPUT_LENGTH}_chars`);
  }

  // 2. 위험 콘텐츠 제거
  for (const pattern of DANGEROUS_OUTPUT_PATTERNS) {
    const before = filtered;
    filtered = filtered.replace(pattern, '[removed]');
    if (before !== filtered) {
      reasons.push('dangerous_content_removed');
      break;
    }
  }

  return {
    filtered,
    wasFiltered: reasons.length > 0,
    reasons,
  };
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 간단한 입력 정제 (문자열만 반환)
 */
export function quickSanitize(text: string): string {
  return sanitizeInput(text).sanitized;
}

/**
 * 간단한 출력 필터 (문자열만 반환)
 */
export function quickFilter(text: string): string {
  return filterResponse(text).filtered;
}

/**
 * HTML 특수문자 이스케이프
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * 안전한 텍스트 출력을 위한 통합 필터
 */
export function safeOutput(text: string): string {
  const filtered = quickFilter(text);
  return escapeHtml(filtered);
}

// ============================================================================
// Prompt Injection 탐지
// ============================================================================

export interface InjectionDetectionResult {
  isInjection: boolean;
  patterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  sanitizedQuery: string;
}

/**
 * Prompt Injection 탐지 (OWASP LLM Top 10 기반)
 */
export function detectPromptInjection(text: string): InjectionDetectionResult {
  const detectedPatterns: string[] = [];
  let sanitizedQuery = text;

  for (const { pattern, name } of PROMPT_INJECTION_PATTERNS) {
    const testPattern = new RegExp(pattern.source, pattern.flags);
    if (testPattern.test(text)) {
      detectedPatterns.push(name);
      sanitizedQuery = sanitizedQuery.replace(pattern, '[blocked]');
    }
  }

  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  if (detectedPatterns.length > 0) {
    const hasHighRisk = detectedPatterns.some(
      (p) =>
        p.includes('jailbreak') ||
        p.includes('dan_mode') ||
        p.includes('bypass') ||
        p.includes('special_mode')
    );
    const hasMediumRisk = detectedPatterns.some(
      (p) =>
        p.includes('ignore') ||
        p.includes('disregard') ||
        p.includes('forget') ||
        p.includes('reveal') ||
        p.includes('show_prompt')
    );

    if (hasHighRisk || detectedPatterns.length >= 3) {
      riskLevel = 'high';
    } else if (hasMediumRisk || detectedPatterns.length >= 2) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
  }

  return {
    isInjection: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    riskLevel,
    sanitizedQuery,
  };
}

/**
 * XML 특수문자 이스케이프
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 프롬프트용 입력 정제 (XML 이스케이프 + Injection 제거)
 */
export function sanitizeForPrompt(text: string): string {
  const { sanitized } = sanitizeInput(text);
  const { sanitizedQuery } = detectPromptInjection(sanitized);
  return escapeXml(sanitizedQuery);
}

// ============================================================================
// 악성 출력 필터링
// ============================================================================

export interface MaliciousOutputResult {
  isMalicious: boolean;
  patterns: string[];
  filteredOutput: string;
  warning?: string;
}

/**
 * 악성 출력 필터링 (AI 응답에서 Injection 성공 징후 탐지)
 */
export function filterMaliciousOutput(text: string): MaliciousOutputResult {
  const detectedPatterns: string[] = [];
  let filteredOutput = text;

  for (const { pattern, name } of MALICIOUS_OUTPUT_PATTERNS) {
    const testPattern = new RegExp(pattern.source, pattern.flags);
    if (testPattern.test(text)) {
      detectedPatterns.push(name);
      filteredOutput = filteredOutput.replace(
        pattern,
        '[응답이 필터링되었습니다]'
      );
    }
  }

  const isMalicious = detectedPatterns.length > 0;

  return {
    isMalicious,
    patterns: detectedPatterns,
    filteredOutput: isMalicious
      ? '죄송합니다. 해당 요청에 응답할 수 없습니다. 서버 모니터링 관련 질문을 해주세요.'
      : filteredOutput,
    warning: isMalicious
      ? `잠재적 보안 위협 감지: ${detectedPatterns.join(', ')}`
      : undefined,
  };
}

// ============================================================================
// 통합 보안 검사
// ============================================================================

/**
 * 통합 보안 검사 (입력 + 출력)
 */
export function securityCheck(input: string): {
  inputCheck: InjectionDetectionResult;
  sanitizedInput: string;
  shouldBlock: boolean;
  warning?: string;
} {
  const inputCheck = detectPromptInjection(input);
  const sanitizedInput = sanitizeForPrompt(input);

  const shouldBlock =
    inputCheck.riskLevel === 'high' || inputCheck.riskLevel === 'medium';

  const warning = inputCheck.isInjection
    ? `보안 경고: Prompt Injection 시도가 감지되어 차단되었습니다 (${inputCheck.patterns.join(', ')}).`
    : undefined;

  return {
    inputCheck,
    sanitizedInput,
    shouldBlock,
    warning,
  };
}
