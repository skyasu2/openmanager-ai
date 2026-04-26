import { syncTopologyToRAG } from './lib/topology-rag-injector';
import { logger } from './lib/logger';

export function setupTopologyRagBackfill(): void {
  const enableTopologyRagSync =
    process.env.ENABLE_TOPOLOGY_RAG_SYNC === 'true';
  const topologyRagSyncMinutes = Math.max(
    30,
    Number.parseInt(process.env.TOPOLOGY_RAG_SYNC_MINUTES || '180', 10) || 180
  );

  if (!enableTopologyRagSync) {
    logger.info(
      'Topology knowledge sync disabled; set ENABLE_TOPOLOGY_RAG_SYNC=true to enable'
    );
    return;
  }

  let syncInFlight = false;

  const runTopologySync = async () => {
    if (syncInFlight) return;
    syncInFlight = true;

    try {
      const result = await syncTopologyToRAG();
      if (result.synced > 0 || result.failed > 0 || result.skipped > 0) {
        logger.info(
          {
            synced: result.synced,
            skipped: result.skipped,
            failed: result.failed,
            error: result.error,
          },
          'Topology knowledge sync run'
        );
      }
    } catch (error) {
      logger.warn({ error }, 'Topology knowledge sync failed');
    } finally {
      syncInFlight = false;
    }
  };

  const initialTimer = setTimeout(() => {
    void runTopologySync();
  }, 20_000);
  if (typeof (initialTimer as NodeJS.Timeout).unref === 'function') {
    (initialTimer as NodeJS.Timeout).unref();
  }

  const intervalMs = topologyRagSyncMinutes * 60 * 1000;
  const intervalTimer = setInterval(() => {
    void runTopologySync();
  }, intervalMs);
  if (typeof (intervalTimer as NodeJS.Timeout).unref === 'function') {
    (intervalTimer as NodeJS.Timeout).unref();
  }

  logger.info(
    { topologyRagSyncMinutes },
    'Topology knowledge periodic sync enabled'
  );
}
