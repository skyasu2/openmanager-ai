import { getOTelHourlyData } from '@/data/otel-data';
import { normalizeJobDataSlot } from '@/lib/ai/query-as-of';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { OTelHourlySlot, OTelLogRecord } from '@/types/otel-metrics';

type IncidentReportRecord = Record<string, unknown>;

type IncidentLogPattern = {
  message: string;
  count: number;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  serverId: string;
  firstSeen: string;
  lastSeen: string;
};

const INCIDENT_LOG_SEVERITIES = new Set(['ERROR', 'WARN', 'WARNING']);
const METRIC_THRESHOLDS = {
  'system.cpu.utilization': { warning: 80, critical: 90 },
  'system.memory.utilization': { warning: 80, critical: 90 },
  'system.filesystem.utilization': { warning: 80, critical: 90 },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function readReportDataSlot(queryAsOf: unknown): JobDataSlot | undefined {
  if (!isRecord(queryAsOf)) return undefined;
  return normalizeJobDataSlot(queryAsOf.dataSlot);
}

function normalizeLogSeverity(value: string): 'ERROR' | 'WARNING' | 'INFO' {
  const normalized = value.toUpperCase();
  if (normalized === 'ERROR' || normalized === 'CRITICAL') return 'ERROR';
  if (normalized === 'WARN' || normalized === 'WARNING') return 'WARNING';
  return 'INFO';
}

function normalizeLogMessage(message: string): string {
  return message
    .replace(/\[[0-9]+\]/g, '[pid]')
    .replace(/\b[0-9]+(?:\.[0-9]+)?%/g, '<pct>%')
    .replace(/\b[0-9]{3,}\b/g, '<num>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function nanoTimeToIso(value: number): string {
  const millis = Math.floor(Number(value) / 1_000_000);
  return Number.isFinite(millis)
    ? new Date(millis).toISOString()
    : new Date().toISOString();
}

function selectTrailingSlots(
  hourlySlots: OTelHourlySlot[],
  slotInHour: number,
  count = 6
): OTelHourlySlot[] {
  const endIndex = Math.min(Math.max(slotInHour, 0), hourlySlots.length - 1);
  const startIndex = Math.max(0, endIndex - count + 1);
  return hourlySlots.slice(startIndex, endIndex + 1);
}

function filterLogsByAffectedServers(
  logs: OTelLogRecord[],
  affectedServers: string[]
): OTelLogRecord[] {
  if (affectedServers.length === 0) return logs;
  const affected = new Set(affectedServers);
  return logs.filter((log) => affected.has(log.resource));
}

export function buildIncidentLogPatternsFromSlots(
  slots: OTelHourlySlot[],
  affectedServers: string[],
  limit = 5
): IncidentLogPattern[] {
  const groups = new Map<
    string,
    {
      message: string;
      count: number;
      severity: 'ERROR' | 'WARNING' | 'INFO';
      serverId: string;
      firstSeen: string;
      lastSeen: string;
    }
  >();

  const logs = filterLogsByAffectedServers(
    slots.flatMap((slot) => slot.logs),
    affectedServers
  );

  for (const log of logs) {
    if (!INCIDENT_LOG_SEVERITIES.has(log.severityText.toUpperCase())) {
      continue;
    }

    const severity = normalizeLogSeverity(log.severityText);
    const message = normalizeLogMessage(log.body);
    const seenAt = nanoTimeToIso(log.timeUnixNano);
    const key = `${severity}:${log.resource}:${message}`;
    const group = groups.get(key) ?? {
      message,
      count: 0,
      severity,
      serverId: log.resource,
      firstSeen: seenAt,
      lastSeen: seenAt,
    };

    group.count += 1;
    if (seenAt < group.firstSeen) group.firstSeen = seenAt;
    if (seenAt > group.lastSeen) group.lastSeen = seenAt;
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.count > 1)
    .sort((left, right) => {
      const severityDiff =
        (right.severity === 'ERROR' ? 1 : 0) -
        (left.severity === 'ERROR' ? 1 : 0);
      return severityDiff !== 0 ? severityDiff : right.count - left.count;
    })
    .slice(0, limit);
}

function readSlotServerStatus(slot: OTelHourlySlot, serverId: string) {
  let warning = false;
  let critical = false;

  for (const metric of slot.metrics) {
    const threshold =
      METRIC_THRESHOLDS[metric.name as keyof typeof METRIC_THRESHOLDS];
    if (!threshold) continue;

    const point = metric.dataPoints.find((dataPoint) =>
      dataPoint.attributes['host.name'].startsWith(`${serverId}.`)
    );
    if (!point) continue;

    const value = point.asDouble <= 1 ? point.asDouble * 100 : point.asDouble;
    if (value >= threshold.critical) {
      critical = true;
    } else if (value >= threshold.warning) {
      warning = true;
    }
  }

  return critical ? 'critical' : warning ? 'warning' : 'online';
}

export function buildIncidentUptimeImpactFromSlots({
  slots,
  affectedServers,
  dataSlot,
}: {
  slots: OTelHourlySlot[];
  affectedServers: string[];
  dataSlot: JobDataSlot;
}) {
  if (slots.length === 0 || affectedServers.length === 0) {
    return {
      dataSlotLabel: dataSlot.timeLabel,
    };
  }

  let impactedServerSlots = 0;
  let totalServerSlots = 0;
  let consecutiveImpactedSlots = 0;

  for (const slot of slots) {
    let slotImpacted = false;
    for (const serverId of affectedServers) {
      const status = readSlotServerStatus(slot, serverId);
      totalServerSlots += 1;
      if (status === 'warning' || status === 'critical') {
        impactedServerSlots += 1;
        slotImpacted = true;
      }
    }
    consecutiveImpactedSlots = slotImpacted ? consecutiveImpactedSlots + 1 : 0;
  }

  const uptimePercent =
    totalServerSlots > 0
      ? Math.round((1 - impactedServerSlots / totalServerSlots) * 1000) / 10
      : undefined;

  return {
    ...(uptimePercent !== undefined && { uptimePercent }),
    affectedDurationMinutes: consecutiveImpactedSlots * 10,
    dataSlotLabel: dataSlot.timeLabel,
  };
}

function readSystemSummary(report: IncidentReportRecord) {
  return isRecord(report.system_summary) ? report.system_summary : {};
}

export async function enrichIncidentReportPayload(
  report: IncidentReportRecord,
  queryAsOf: unknown
): Promise<IncidentReportRecord> {
  const dataSlot = readReportDataSlot(queryAsOf);
  if (!dataSlot) return report;

  const hour = Math.floor(dataSlot.minuteOfDay / 60);
  const slotInHour = Math.floor((dataSlot.minuteOfDay % 60) / 10);
  const hourlyData = await getOTelHourlyData(hour);
  if (!hourlyData) return report;

  const slots = selectTrailingSlots(hourlyData.slots, slotInHour);
  const affectedServers = readStringArray(report.affected_servers);
  const logPatterns = buildIncidentLogPatternsFromSlots(slots, affectedServers);
  const uptimeImpact = buildIncidentUptimeImpactFromSlots({
    slots,
    affectedServers,
    dataSlot,
  });

  return {
    ...report,
    ...(logPatterns.length > 0 ? { log_patterns: logPatterns } : {}),
    system_summary: {
      ...readSystemSummary(report),
      ...uptimeImpact,
    },
  };
}
