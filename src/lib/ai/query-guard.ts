import {
  detectPromptInjection,
  sanitizeInput,
} from '@/app/api/ai/supervisor/security';

export type QueryVerdict = 'allow' | 'block' | 'sanitize';
export type InputType = 'natural_query' | 'log_paste' | 'mixed' | 'oversized';

export interface QueryGuardResult {
  verdict: QueryVerdict;
  inputType: InputType;
  sanitizedQuery: string;
  fullQuery: string;
  blockReason?: string;
  logExtract?: string;
  truncated: boolean;
}

export const BLOCKED_INPUT_MESSAGE =
  '입력 내용이 서버 모니터링 AI가 처리할 수 없는 형식입니다. 다른 표현으로 다시 시도해주세요.';

const NLQ_QUERY_LIMIT = 500;
const FULL_QUERY_LIMIT = 10_000;
const LOG_EXTRACT_LINE_LIMIT = 80;
const LOG_EXTRACT_CHAR_LIMIT = 8_000;
const LOG_PROMPT_LOG_CHAR_LIMIT = 1_800;
const LOG_PROMPT_CHAR_LIMIT = 2_500;

const LOG_TIMESTAMP_PATTERN =
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}|\[\d{2}:\d{2}:\d{2}\]|\b\d{10,13}\b/;
const LOG_LEVEL_PATTERN =
  /\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL|TRACE|CRITICAL)\b/i;
const STACK_TRACE_PATTERN =
  /^\s+at\s+[\w.$<>]+|Exception:|Traceback \(|goroutine\s+\d+\s+\[/i;
const HIGH_VALUE_LOG_PATTERN =
  /\b(ERROR|WARN|WARNING|FATAL|CRITICAL)\b|Exception:|Traceback \(|^\s+at\s+[\w.$<>]+|goroutine\s+\d+\s+\[/i;

function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength);
}

function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

function isLogLikeLine(line: string): boolean {
  return (
    LOG_TIMESTAMP_PATTERN.test(line) ||
    LOG_LEVEL_PATTERN.test(line) ||
    STACK_TRACE_PATTERN.test(line)
  );
}

function classifyInput(value: string): InputType {
  const lines = splitNonEmptyLines(value);
  if (lines.length >= 5) {
    const logLineCount = lines.filter(isLogLikeLine).length;
    const logRatio = logLineCount / lines.length;

    if (logRatio > 0.6) return 'log_paste';
    if (logRatio >= 0.2 && logRatio <= 0.6) return 'mixed';
  }

  return value.length > NLQ_QUERY_LIMIT ? 'oversized' : 'natural_query';
}

function extractNaturalLanguageHint(value: string): string {
  const lines = splitNonEmptyLines(value).filter(
    (line) => !isLogLikeLine(line)
  );
  return clampText(lines.join('\n').trim(), NLQ_QUERY_LIMIT);
}

function buildDefaultLogQuery(inputType: InputType): string {
  return inputType === 'mixed'
    ? '로그와 사용자 설명에서 문제 서버, 메트릭, 시간 범위를 추출'
    : '로그에서 문제 서버, 메트릭, 시간 범위를 추출';
}

export function extractRelevantLogLines(rawInput: string): string {
  const lines = splitNonEmptyLines(rawInput);
  const relevantLines = lines.filter((line) =>
    HIGH_VALUE_LOG_PATTERN.test(line)
  );
  const selectedLines = (
    relevantLines.length > 0 ? relevantLines : lines
  ).slice(-LOG_EXTRACT_LINE_LIMIT);

  let extract = selectedLines.join('\n');
  if (extract.length > LOG_EXTRACT_CHAR_LIMIT) {
    extract = extract.slice(-LOG_EXTRACT_CHAR_LIMIT);
    const firstNewline = extract.indexOf('\n');
    if (firstNewline > 0) {
      extract = extract.slice(firstNewline + 1);
    }
  }

  return extract;
}

export function buildLogSummaryPrompt(
  logExtract: string,
  naturalLanguageHint?: string
): string {
  const boundedHint = clampText((naturalLanguageHint ?? '').trim(), 500);
  const boundedLog = clampText(logExtract.trim(), LOG_PROMPT_LOG_CHAR_LIMIT);
  const prompt = [
    '로그에서 서버 모니터링 엔티티를 추출하세요.',
    '서버 ID, 메트릭(cpu|memory|disk|network), 시간 범위, 의도만 JSON으로 판단하세요.',
    boundedHint ? `사용자 요청:\n${boundedHint}` : '',
    `로그 발췌:\n${boundedLog}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return clampText(prompt, LOG_PROMPT_CHAR_LIMIT);
}

export function runQueryGuard(rawInput: string): QueryGuardResult {
  const sanitized = sanitizeInput(rawInput);
  const fullQuery = clampText(sanitized.sanitized.trim(), FULL_QUERY_LIMIT);
  const injection = detectPromptInjection(fullQuery);

  if (injection.riskLevel === 'high') {
    return {
      verdict: 'block',
      inputType: 'natural_query',
      sanitizedQuery: '',
      fullQuery,
      blockReason: 'prompt_injection_high',
      truncated: sanitized.modifications.some((item) =>
        item.startsWith('truncated_to_')
      ),
    };
  }

  const queryAfterInjection = injection.sanitizedQuery.trim();
  const inputType = classifyInput(queryAfterInjection);
  const logExtract =
    inputType === 'log_paste' || inputType === 'mixed'
      ? extractRelevantLogLines(queryAfterInjection)
      : undefined;
  const naturalLanguageHint =
    inputType === 'mixed'
      ? extractNaturalLanguageHint(queryAfterInjection)
      : undefined;

  const sanitizedQuery =
    inputType === 'log_paste' || inputType === 'mixed'
      ? naturalLanguageHint || buildDefaultLogQuery(inputType)
      : clampText(queryAfterInjection, NLQ_QUERY_LIMIT);

  const nlqTruncated =
    inputType !== 'log_paste' &&
    inputType !== 'mixed' &&
    queryAfterInjection.length > NLQ_QUERY_LIMIT;
  const fullQueryTruncated = sanitized.modifications.some((item) =>
    item.startsWith('truncated_to_')
  );

  return {
    verdict: injection.riskLevel === 'medium' ? 'sanitize' : 'allow',
    inputType,
    sanitizedQuery,
    fullQuery,
    ...(injection.riskLevel === 'medium' && {
      blockReason: 'prompt_injection_medium',
    }),
    ...(logExtract && { logExtract }),
    truncated: fullQueryTruncated || nlqTruncated,
  };
}
