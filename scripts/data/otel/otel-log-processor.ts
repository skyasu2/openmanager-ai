/**
 * OTel Log Processor
 *
 * 기존 문자열 로그 → OTel LogRecord 구조화.
 * SeverityNumber는 OTel Log Data Model 기준.
 *
 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#severity-fields
 * @created 2026-02-11
 */

import type { OTelLogRecord, OTelResourceAttributes } from './types';

// ============================================================================
// Server Metadata (for attribute enrichment)
// ============================================================================

type ServerMeta = Pick<
  OTelResourceAttributes,
  'server.role' | 'deployment.environment' | 'cloud.availability_zone'
>;

// ============================================================================
// Source Detection (syslog body → process name)
// ============================================================================

const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /\bnginx\b/i, source: 'nginx' },
  { pattern: /\bapache\b/i, source: 'apache' },
  { pattern: /\bsshd\b/i, source: 'sshd' },
  { pattern: /\bsystemd\b/i, source: 'systemd' },
  { pattern: /\bcron\b/i, source: 'cron' },
  { pattern: /\bkernel\b/i, source: 'kernel' },
  { pattern: /\bpostgres\b/i, source: 'postgres' },
  { pattern: /\bmysql\b|\bmariadb\b/i, source: 'mysql' },
  { pattern: /\bredis\b/i, source: 'redis' },
  { pattern: /\bmongod?\b/i, source: 'mongodb' },
  { pattern: /\bhaproxy\b/i, source: 'haproxy' },
  { pattern: /\bnode\b|\.js\b/i, source: 'node' },
  { pattern: /\bdocker\b|container/i, source: 'docker' },
  { pattern: /\bkube\b|k8s/i, source: 'kubelet' },
];

/**
 * syslog body에서 프로세스 이름 추출
 */
function detectSource(body: string): string {
  for (const { pattern, source } of SOURCE_PATTERNS) {
    if (pattern.test(body)) return source;
  }
  return 'syslog';
}

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
 *
 * @param logLine - 원본 syslog 문자열
 * @param serverId - 서버 ID (e.g. "web-nginx-dc1-01")
 * @param timestampMs - 밀리초 타임스탬프
 * @param serverMeta - resource-catalog 메타데이터 (Loki labels 매핑용)
 */
export function processLogLine(
  logLine: string,
  serverId: string,
  timestampMs: number,
  serverMeta?: ServerMeta
): OTelLogRecord {
  const { severityNumber, severityText } = detectSeverity(logLine);
  const body = stripSeverityPrefix(logLine);

  return {
    timeUnixNano: timestampMs * 1_000_000,
    severityNumber,
    severityText,
    body,
    attributes: {
      'log.source': detectSource(body),
      'server.role': serverMeta?.['server.role'] ?? 'unknown',
      'deployment.environment':
        serverMeta?.['deployment.environment'] ?? 'production',
      'cloud.availability_zone':
        serverMeta?.['cloud.availability_zone'] ?? 'unknown',
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
  timestampMs: number,
  serverMeta?: ServerMeta
): OTelLogRecord[] {
  return logs.map((logLine) =>
    processLogLine(logLine, serverId, timestampMs, serverMeta)
  );
}
