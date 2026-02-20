import { syncIncidentsToRAG } from './lib/incident-rag-injector';
import { logger } from './lib/logger';

export function setupIncidentRagBackfill(): void {
  const enableIncidentRagBackfill =
    process.env.ENABLE_INCIDENT_RAG_BACKFILL !== 'false';
  const incidentRagBackfillMinutes = Math.max(
    5,
    Number.parseInt(process.env.INCIDENT_RAG_BACKFILL_MINUTES || '30', 10) || 30
  );

  if (!enableIncidentRagBackfill) {
    return;
  }

  let backfillInFlight = false;

  const runIncidentRagBackfill = async () => {
    if (backfillInFlight) return;
    backfillInFlight = true;

    try {
      const result = await syncIncidentsToRAG({ limit: 3, daysBack: 30 });
      if (result.synced > 0 || result.failed > 0) {
        logger.info(
          {
            synced: result.synced,
            skipped: result.skipped,
            failed: result.failed,
            errors: result.errors.slice(0, 3),
          },
          'Incident RAG backfill run'
        );
      }
    } catch (error) {
      logger.warn({ error }, 'Incident RAG backfill failed');
    } finally {
      backfillInFlight = false;
    }
  };

  const initialTimer = setTimeout(() => {
    void runIncidentRagBackfill();
  }, 15_000);
  if (typeof (initialTimer as NodeJS.Timeout).unref === 'function') {
    (initialTimer as NodeJS.Timeout).unref();
  }

  const intervalMs = incidentRagBackfillMinutes * 60 * 1000;
  const intervalTimer = setInterval(() => {
    void runIncidentRagBackfill();
  }, intervalMs);
  if (typeof (intervalTimer as NodeJS.Timeout).unref === 'function') {
    (intervalTimer as NodeJS.Timeout).unref();
  }

  logger.info(
    { incidentRagBackfillMinutes },
    'Incident RAG periodic backfill enabled'
  );
}
