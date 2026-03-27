import { logger } from '../../lib/logger';
import { flushLangfuse } from './langfuse';

export async function flushLangfuseBestEffort(
  scope: string,
  timeoutMs: number = 350,
): Promise<void> {
  await Promise.race([
    flushLangfuse(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]).catch((error) => {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      `${scope}: Langfuse flush skipped`,
    );
  });
}
