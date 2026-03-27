import { logger } from '../../../lib/logger';

export async function waitForStreamField<T>(
  agentName: string,
  fieldName: string,
  value: T | Promise<T> | PromiseLike<T>,
  timeoutMs: number
): Promise<T | null> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T | null>((resolve) => {
    timeoutHandle = setTimeout(() => {
      logger.warn(
        `[${agentName}] Stream ${fieldName} not ready within ${timeoutMs}ms; continuing without it.`
      );
      resolve(null);
    }, timeoutMs);
  });

  try {
    const resolved = await Promise.race([Promise.resolve(value), timeout]);
    return resolved;
  } catch (error) {
    logger.warn(
      `[${agentName}] Failed to read stream ${fieldName}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
