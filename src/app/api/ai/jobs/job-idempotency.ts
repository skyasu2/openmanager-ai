import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { redisGet } from '@/lib/redis';
import type { CreateJobRequest, CreateJobResponse } from '@/types/ai-jobs';

export const JOB_IDEMPOTENCY_PENDING_TTL_SECONDS = 60;

export interface JobIdempotencyRecord {
  status: 'pending' | 'created';
  fingerprint: string;
  createdAt: string;
  jobId?: string;
  response?: CreateJobResponse;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildJobIdempotencyRedisKey(
  ownerKey: string,
  sessionId: string | undefined,
  idempotencyKey: string
): string {
  const ownerHash = hashValue(ownerKey).slice(0, 16);
  const sessionHash = hashValue(sessionId ?? 'global').slice(0, 16);
  const keyHash = hashValue(idempotencyKey);

  return `job:idempotency:${ownerHash}:${sessionHash}:${keyHash}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? 'null' : serialized;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
    )
    .join(',')}}`;
}

export function buildJobRequestFingerprint(
  query: string,
  jobType: CreateJobRequest['type'],
  options: CreateJobRequest['options']
): string {
  return hashValue(
    stableSerialize({
      query,
      type: jobType ?? null,
      options: options ?? null,
    })
  );
}

function isJobIdempotencyRecord(value: unknown): value is JobIdempotencyRecord {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<JobIdempotencyRecord>;
  return (
    (candidate.status === 'pending' || candidate.status === 'created') &&
    typeof candidate.fingerprint === 'string'
  );
}

export function createJobCreatedResponse(response: CreateJobResponse) {
  const triggerStatus = response.triggerStatus ?? 'skipped';

  return NextResponse.json(response, {
    status: 201,
    headers: {
      'X-AI-Mode': response.routingMode ?? 'job-queue',
      'X-AI-Job-Complexity': response.complexity ?? 'unknown',
      'X-AI-Estimated-Time-Sec': String(response.estimatedTime),
      'X-AI-Trigger-Status': triggerStatus,
    },
  });
}

function createIdempotencyPendingResponse() {
  return NextResponse.json(
    {
      error: 'Job creation in progress',
      reason: 'idempotency_pending',
    },
    {
      status: 503,
      headers: {
        'Retry-After': '1',
      },
    }
  );
}

function createIdempotencyConflictResponse() {
  return NextResponse.json(
    {
      error: 'Idempotency key conflict',
      reason: 'idempotency_fingerprint_mismatch',
    },
    { status: 409 }
  );
}

export async function createExistingIdempotencyResponse(
  idempotencyRedisKey: string,
  requestFingerprint: string
) {
  const existingRecord =
    await redisGet<JobIdempotencyRecord>(idempotencyRedisKey);

  if (!isJobIdempotencyRecord(existingRecord)) {
    return createIdempotencyPendingResponse();
  }

  if (
    existingRecord.status === 'created' &&
    existingRecord.fingerprint !== requestFingerprint
  ) {
    return createIdempotencyConflictResponse();
  }

  if (existingRecord.status === 'created' && existingRecord.response) {
    return createJobCreatedResponse(existingRecord.response);
  }

  return createIdempotencyPendingResponse();
}
