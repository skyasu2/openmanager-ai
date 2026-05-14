import { normalizeQueryAsOf } from '../data/query-as-of-context';
import { logger } from '../lib/logger';
import {
  createMonitoringDataSource,
  type MonitoringEvidenceRef,
  type MonitoringIncidentTimeline,
  type MonitoringSourceMode,
} from '../services/monitoring/monitoring-data-source';
import { readMonitoringSourceMode } from './analytics-route-utils';

interface ReporterMonitoringGrounding {
  sourceMode?: MonitoringSourceMode;
  queryAsOf?: string;
  evidenceRefs: MonitoringEvidenceRef[];
  timeline: MonitoringIncidentTimeline | null;
}

function mergeEvidenceRefs(
  evidenceRefs: MonitoringEvidenceRef[]
): MonitoringEvidenceRef[] {
  const refsById = new Map<string, MonitoringEvidenceRef>();
  for (const evidenceRef of evidenceRefs) {
    if (!refsById.has(evidenceRef.id)) {
      refsById.set(evidenceRef.id, evidenceRef);
    }
  }
  return Array.from(refsById.values()).slice(0, 40);
}

export async function collectReporterMonitoringGrounding(input: {
  sourceMode: unknown;
  queryAsOf: unknown;
  serverId?: string;
}): Promise<ReporterMonitoringGrounding> {
  try {
    const source = createMonitoringDataSource({
      mode: readMonitoringSourceMode(input.sourceMode),
    });
    const queryAsOf = normalizeQueryAsOf(input.queryAsOf);
    const [snapshot, timeline] = await Promise.all([
      source.getSnapshot({ queryAsOf }),
      source.buildIncidentTimeline({
        queryAsOf,
        serverId: input.serverId,
        limit: 20,
      }),
    ]);

    return {
      sourceMode: snapshot.sourceMode,
      queryAsOf: snapshot.queryAsOf,
      evidenceRefs: mergeEvidenceRefs([
        ...snapshot.evidenceRefs,
        ...timeline.evidenceRefs,
      ]),
      timeline,
    };
  } catch (error) {
    logger.warn(
      { err: error },
      '[Incident Report] Monitoring grounding unavailable, continuing with legacy tools'
    );
    return {
      evidenceRefs: [],
      timeline: null,
    };
  }
}

export function buildMonitoringEvidenceContext(
  grounding: ReporterMonitoringGrounding
): string {
  if (grounding.evidenceRefs.length === 0) {
    return '';
  }

  return `
- Monitoring sourceMode: ${grounding.sourceMode ?? 'unknown'}
- Monitoring queryAsOf: ${grounding.queryAsOf ?? 'unknown'}
- Monitoring evidenceRefs: ${JSON.stringify(grounding.evidenceRefs.slice(0, 8)).slice(0, 900)}
- Monitoring timeline: ${JSON.stringify(grounding.timeline?.events.slice(0, 8) ?? []).slice(0, 500)}`;
}
