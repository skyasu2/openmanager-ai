/**
 * Unified Stream Security Module
 * 경량화된 입력/출력 보안 필터
 *
 * @description Cloud Run AI Supervisor API의 보안 레이어
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
  let sensitiveInfoMasked = false;
  for (const pattern of SENSITIVE_PATTERNS) {
    const before = sanitized;
    sanitized = sanitized.replace(pattern, '[REDACTED]');
    if (before !== sanitized && !sensitiveInfoMasked) {
      modifications.push('sensitive_info_masked');
      sensitiveInfoMasked = true;
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

const ENCODED_TOKEN_PATTERN =
  /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{16,}={0,2}(?![A-Za-z0-9+/=])/g;
const MAX_DECODED_SCAN_CHARS = 4_000;

function scanInjectionPatterns(text: string): string[] {
  const detectedPatterns: string[] = [];
  for (const { pattern, name } of PROMPT_INJECTION_PATTERNS) {
    const scanner = new RegExp(pattern.source, pattern.flags);
    if (scanner.test(text)) detectedPatterns.push(name);
  }
  return detectedPatterns;
}

function extractDecodedBase64Segments(text: string): string {
  const tokens = text.match(ENCODED_TOKEN_PATTERN) ?? [];
  const decoded: string[] = [];

  for (const token of tokens) {
    if (token.length > 512 || token.length % 4 !== 0) continue;

    try {
      const output = Buffer.from(token, 'base64').toString('utf8');
      if (output.length > 0 && output.length <= MAX_DECODED_SCAN_CHARS) {
        decoded.push(output);
      }
    } catch {}
  }

  return decoded.join('\n');
}

/**
 * Prompt Injection 탐지 (OWASP LLM Top 10 기반)
 */
export function detectPromptInjection(text: string): InjectionDetectionResult {
  const detectedPatterns = scanInjectionPatterns(text);
  let sanitizedQuery = text;

  for (const { pattern, name } of PROMPT_INJECTION_PATTERNS) {
    if (detectedPatterns.includes(name)) {
      sanitizedQuery = sanitizedQuery.replace(pattern, '[blocked]');
    }
    pattern.lastIndex = 0;
  }

  const decoded = extractDecodedBase64Segments(text);
  if (decoded) {
    for (const name of scanInjectionPatterns(decoded)) {
      detectedPatterns.push(`encoded:${name}`);
    }
  }

  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  if (detectedPatterns.length > 0) {
    const hasHighRisk = detectedPatterns.some(
      (p) =>
        p.startsWith('encoded:') ||
        p.includes('jailbreak') ||
        p.includes('dan_mode') ||
        p.includes('bypass') ||
        p.includes('special_mode') ||
        p.includes('roleplay') ||
        p.includes('role_reassignment') ||
        p.includes('unrestricted')
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
    ? inputCheck.riskLevel === 'low'
      ? `보안 알림: 의심스러운 패턴이 감지되어 정제되었습니다 (${inputCheck.patterns.join(', ')}).`
      : `보안 경고: Prompt Injection 시도가 감지되어 차단되었습니다 (${inputCheck.patterns.join(', ')}).`
    : undefined;

  return {
    inputCheck,
    sanitizedInput,
    shouldBlock,
    warning,
  };
}
