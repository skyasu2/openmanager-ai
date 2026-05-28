import type { DomainSnapshot } from '../../core/assistant-runtime';

export type SnapshotServer = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  location?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readSnapshotTimeLabel(snapshot: DomainSnapshot): string | undefined {
  return isRecord(snapshot.data) ? readString(snapshot.data.timeLabel) : undefined;
}

export function readSnapshotSlotIndex(snapshot: DomainSnapshot): number | undefined {
  return isRecord(snapshot.data) ? readFiniteNumber(snapshot.data.slotIndex) : undefined;
}

export function readSnapshotServers(snapshot: DomainSnapshot): SnapshotServer[] {
  const servers = isRecord(snapshot.data) ? snapshot.data.servers : undefined;
  if (!Array.isArray(servers)) return [];

  return servers.filter((server): server is SnapshotServer => {
    return isRecord(server) && typeof server.id === 'string';
  });
}
