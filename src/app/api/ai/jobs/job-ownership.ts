import type { NextRequest } from 'next/server';
import { getSessionOwnerKey } from '../supervisor/session-owner';

export function buildScopedJobListKey(
  ownerKey: string,
  sessionId: string
): string {
  return `job:list:${ownerKey}:${sessionId}`;
}

export function resolveJobOwnerKey(request: NextRequest): string {
  return getSessionOwnerKey(request);
}

function getMetadataOwnerKey(job: unknown): unknown {
  if (!job || typeof job !== 'object' || !('metadata' in job)) {
    return null;
  }

  const metadata = job.metadata;
  if (!metadata || typeof metadata !== 'object' || !('ownerKey' in metadata)) {
    return null;
  }

  return metadata.ownerKey;
}

export function getStoredJobOwnerKey(job: unknown): string | null {
  const ownerKey = getMetadataOwnerKey(job);
  return typeof ownerKey === 'string' && ownerKey.trim().length > 0
    ? ownerKey
    : null;
}

export function isJobOwnedByRequester(
  job: unknown,
  request: NextRequest
): boolean {
  const storedOwnerKey = getStoredJobOwnerKey(job);
  if (!storedOwnerKey) {
    return false;
  }

  return storedOwnerKey === resolveJobOwnerKey(request);
}
