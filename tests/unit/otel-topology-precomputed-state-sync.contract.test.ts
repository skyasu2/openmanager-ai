import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ResourceCatalog = {
  resources: Record<string, Record<string, string | number>>;
};

type PrecomputedSlot = {
  servers?: Array<{ id?: string; serverId?: string }>;
};

const ROOT_CATALOG = path.resolve(
  'public/data/otel-data/resource-catalog.json'
);
const ENGINE_CATALOG = path.resolve(
  'cloud-run/ai-engine/data/otel-data/resource-catalog.json'
);
const ENGINE_PRECOMPUTED = path.resolve(
  'cloud-run/ai-engine/data/precomputed-states.json'
);
const REQUIRED_IDS = [
  'lb-haproxy-dc1-03',
  'cache-redis-dc1-03',
  'storage-nfs-dc1-02',
] as const;

describe('OTel precomputed-state sync contract', () => {
  it('keeps bundled ai-engine otel-data inventory in sync with public SSOT', () => {
    const rootCatalog: ResourceCatalog = JSON.parse(
      fs.readFileSync(ROOT_CATALOG, 'utf8')
    );
    const engineCatalog: ResourceCatalog = JSON.parse(
      fs.readFileSync(ENGINE_CATALOG, 'utf8')
    );

    const rootIds = Object.keys(rootCatalog.resources).sort();
    const engineIds = Object.keys(engineCatalog.resources).sort();

    expect(engineIds).toEqual(rootIds);
    expect(engineIds).toHaveLength(18);
    for (const id of REQUIRED_IDS) {
      expect(engineCatalog.resources[id]?.['host.name']).toBe(
        `${id}.openmanager.kr`
      );
    }
  });

  it('rebuilds precomputed-states.json with the 18-server inventory', () => {
    const slots: PrecomputedSlot[] = JSON.parse(
      fs.readFileSync(ENGINE_PRECOMPUTED, 'utf8')
    );
    const uniqueIds = new Set<string>();

    for (const slot of slots) {
      for (const server of slot.servers ?? []) {
        const id = server.id ?? server.serverId;
        if (id) uniqueIds.add(id);
      }
    }

    expect(slots).toHaveLength(144);
    expect(uniqueIds.size).toBe(18);
    for (const id of REQUIRED_IDS) {
      expect(uniqueIds.has(id)).toBe(true);
    }
  });
});
