import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const syncMocks = vi.hoisted(() => ({
  incidents: vi.fn(async () => ({
    success: true,
    synced: 1,
    skipped: 0,
    failed: 0,
    errors: [],
  })),
  topology: vi.fn(async () => ({
    success: true,
    synced: 1,
    skipped: 0,
    failed: 0,
  })),
}));

vi.mock('./lib/incident-rag-injector', () => ({
  syncIncidentsToRAG: syncMocks.incidents,
}));

vi.mock('./lib/topology-rag-injector', () => ({
  syncTopologyToRAG: syncMocks.topology,
}));

vi.mock('./lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { setupIncidentRagBackfill } from './server-incident-rag-backfill';
import { setupTopologyRagBackfill } from './server-topology-rag-backfill';

describe('server knowledge corpus sync scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    delete process.env.ENABLE_INCIDENT_RAG_BACKFILL;
    delete process.env.ENABLE_TOPOLOGY_RAG_SYNC;
    delete process.env.INCIDENT_RAG_BACKFILL_MINUTES;
    delete process.env.TOPOLOGY_RAG_SYNC_MINUTES;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps incident and topology knowledge sync disabled by default', async () => {
    setupIncidentRagBackfill();
    setupTopologyRagBackfill();

    await vi.advanceTimersByTimeAsync(25_000);

    expect(syncMocks.incidents).not.toHaveBeenCalled();
    expect(syncMocks.topology).not.toHaveBeenCalled();
  });

  it('schedules incident knowledge sync only when explicitly enabled', async () => {
    process.env.ENABLE_INCIDENT_RAG_BACKFILL = 'true';

    setupIncidentRagBackfill();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(syncMocks.incidents).toHaveBeenCalledTimes(1);
    expect(syncMocks.incidents).toHaveBeenCalledWith({
      limit: 3,
      daysBack: 30,
    });
  });

  it('schedules topology knowledge sync only when explicitly enabled', async () => {
    process.env.ENABLE_TOPOLOGY_RAG_SYNC = 'true';

    setupTopologyRagBackfill();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(syncMocks.topology).toHaveBeenCalledTimes(1);
  });
});
