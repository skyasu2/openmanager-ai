/**
 * OTel Log Processor
 *
 * 기존 문자열 로그 → OTel LogRecord 구조화.
 * SeverityNumber는 OTel Log Data Model 기준.
 *
 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#severity-fields
 * @created 2026-02-11
 */

import type { OTelLogRecord } from './types';

// ============================================================================
// Severity Mapping
// ============================================================================

type SeverityLevel = {
  pattern: RegExp;
  severityNumber: number;
  severityText: string;
};

const SEVERITY_LEVELS: SeverityLevel[] = [
  { pattern: /^\[CRITICAL\]/, severityNumber: 21, severityText: 'CRITICAL' },
  { pattern: /^\[ERROR\]/, severityNumber: 17, severityText: 'ERROR' },
  { pattern: /^\[WARN(?:ING)?\]/, severityNumber: 13, severityText: 'WARN' },
  { pattern: /^\[INFO\]/, severityNumber: 9, severityText: 'INFO' },
  { pattern: /^\[DEBUG\]/, severityNumber: 5, severityText: 'DEBUG' },
  { pattern: /^\[TRACE\]/, severityNumber: 1, severityText: 'TRACE' },
];

const DEFAULT_SEVERITY: Pick<SeverityLevel, 'severityNumber' | 'severityText'> = {
  severityNumber: 9,
  severityText: 'INFO',
};

// ============================================================================
// Log Processing
// ============================================================================

/**
 * severity 레벨 감지
 */
function detectSeverity(logLine: string): Pick<SeverityLevel, 'severityNumber' | 'severityText'> {
  for (const level of SEVERITY_LEVELS) {
    if (level.pattern.test(logLine)) {
      return { severityNumber: level.severityNumber, severityText: level.severityText };
    }
  }
  return DEFAULT_SEVERITY;
}

/**
 * 로그 본문에서 severity prefix 제거
 */
function stripSeverityPrefix(logLine: string): string {
  return logLine.replace(/^\[(CRITICAL|ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE)\]\s*/, '');
}

/**
 * 단일 문자열 로그 → OTel LogRecord 변환
 */
export function processLogLine(
  logLine: string,
  serverId: string,
  timestampMs: number
): OTelLogRecord {
  const { severityNumber, severityText } = detectSeverity(logLine);
  const body = stripSeverityPrefix(logLine);

  return {
    timeUnixNano: timestampMs * 1_000_000,
    severityNumber,
    severityText,
    body,
    attributes: {
      'log.source': 'openmanager-ai',
    },
    resource: serverId,
  };
}

/**
 * 서버의 전체 로그 배열 → OTel LogRecord 배열
 */
export function processServerLogs(
  logs: string[],
  serverId: string,
  timestampMs: number
): OTelLogRecord[] {
  return logs.map((logLine) => processLogLine(logLine, serverId, timestampMs));
}
