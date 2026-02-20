import { logger } from './lib/logger';
import { flushLangfuse, shutdownLangfuse } from './services/observability/langfuse';

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  const SHUTDOWN_TIMEOUT_MS = 30_000;
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    logger.info('Flushing Langfuse traces');
    await flushLangfuse();

    logger.info('Shutting down Langfuse');
    await shutdownLangfuse();

    clearTimeout(timeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

export function registerGracefulShutdownHandlers(): void {
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
}
