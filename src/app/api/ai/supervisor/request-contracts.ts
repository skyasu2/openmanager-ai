import { z } from 'zod';

export const SUPERVISOR_SESSION_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
export const SUPERVISOR_SESSION_ID_PATTERN = '^[A-Za-z0-9_-]{8,128}$' as const;
export const INVALID_SESSION_ID_MESSAGE =
  'sessionId must be 8-128 chars using only letters, numbers, underscore, or hyphen';

export const SUPERVISOR_SESSION_ID_SCHEMA = z
  .string()
  .regex(SUPERVISOR_SESSION_ID_REGEX, INVALID_SESSION_ID_MESSAGE);

export type SupervisorDeviceType = 'mobile' | 'desktop';

export function normalizeSupervisorSessionId(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = SUPERVISOR_SESSION_ID_SCHEMA.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

export function normalizeSupervisorDeviceType(
  value: string | null | undefined
): SupervisorDeviceType {
  return value === 'mobile' ? 'mobile' : 'desktop';
}
