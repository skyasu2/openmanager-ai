import { logger } from '../../lib/logger';

const SUPERVISOR_FALLBACK_BASE_DELAY_MS = 150;
const SUPERVISOR_FALLBACK_JITTER_MS = 250;
const AGENT_FALLBACK_BASE_DELAY_MS = 120;
const AGENT_FALLBACK_JITTER_MS = 280;

async function waitBeforeProviderFallback({
  logPrefix,
  provider,
  reason,
  baseDelayMs,
  jitterMs,
}: {
  logPrefix: string;
  provider: string;
  reason: string;
  baseDelayMs: number;
  jitterMs: number;
}): Promise<void> {
  const jitter = Math.floor(Math.random() * (jitterMs + 1));
  const delay = baseDelayMs + jitter;
  logger.debug(
    `${logPrefix} Provider fallback delay ${delay}ms (${provider}, reason=${reason})`
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

export function waitBeforeSupervisorProviderFallback(
  provider: string,
  reason: string
): Promise<void> {
  return waitBeforeProviderFallback({
    logPrefix: '[SupervisorStream]',
    provider,
    reason,
    baseDelayMs: SUPERVISOR_FALLBACK_BASE_DELAY_MS,
    jitterMs: SUPERVISOR_FALLBACK_JITTER_MS,
  });
}

export function waitBeforeAgentProviderFallback(
  agentName: string,
  provider: string,
  reason: string
): Promise<void> {
  return waitBeforeProviderFallback({
    logPrefix: `[Stream ${agentName}]`,
    provider,
    reason,
    baseDelayMs: AGENT_FALLBACK_BASE_DELAY_MS,
    jitterMs: AGENT_FALLBACK_JITTER_MS,
  });
}
