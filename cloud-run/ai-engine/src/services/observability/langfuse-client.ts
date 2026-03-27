import { logger } from '../../lib/logger';
import type {
  LangfuseClient,
  LangfuseConfig,
  LangfuseConstructor,
} from './langfuse-contracts';
import { isLangfuseTestModeEnabled, setLangfuseTestModeEnabled } from './langfuse-flags';
import { createNoOpLangfuse } from './langfuse-noop';

let LangfuseClass: LangfuseConstructor | null = null;
let loadAttempted = false;

let langfuseClient: LangfuseClient | null = null;
let initPromise: Promise<LangfuseClient> | null = null;
let langfuseOperational = false;

async function loadLangfuse(): Promise<LangfuseConstructor | null> {
  if (loadAttempted) {
    return LangfuseClass;
  }
  loadAttempted = true;

  try {
    const module = (await import('langfuse' as string)) as { Langfuse: LangfuseConstructor };
    LangfuseClass = module.Langfuse;
    return LangfuseClass;
  } catch {
    langfuseOperational = false;
    logger.warn('[Langfuse] Module not installed, observability disabled');
    return null;
  }
}

function getFlushConfig(): Pick<LangfuseConfig, 'flushAt' | 'flushInterval'> {
  if (isLangfuseTestModeEnabled()) {
    return { flushAt: 1, flushInterval: 1000 };
  }

  return { flushAt: 10, flushInterval: 5000 };
}

async function initLangfuse(): Promise<LangfuseClient> {
  const Langfuse = await loadLangfuse();

  if (!Langfuse) {
    langfuseOperational = false;
    return createNoOpLangfuse();
  }

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!secretKey || !publicKey) {
    langfuseOperational = false;
    logger.warn('[Langfuse] Missing API keys, observability disabled');
    return createNoOpLangfuse();
  }

  const flushConfig = getFlushConfig();
  const client = new Langfuse({
    secretKey,
    publicKey,
    baseUrl,
    ...flushConfig,
  });

  langfuseOperational = true;
  logger.info(`[Langfuse] Initialized with ${baseUrl} (flushAt: ${flushConfig.flushAt})`);
  return client;
}

function ensureInitPromise(): Promise<LangfuseClient> {
  if (!initPromise) {
    initPromise = initLangfuse().then((client) => {
      langfuseClient = client;
      return client;
    });
  }

  return initPromise;
}

async function reinitializeLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
    initPromise = null;
    langfuseOperational = false;
  }

  await ensureInitPromise();
}

export function getLangfuse(): LangfuseClient {
  if (!langfuseClient) {
    void ensureInitPromise();
    return createNoOpLangfuse();
  }

  return langfuseClient;
}

export function isLangfuseOperational(): boolean {
  return langfuseClient !== null && langfuseOperational;
}

export function getLangfuseClientStatus(): {
  isOperational: boolean;
  clientInitialized: boolean;
  loadAttempted: boolean;
  hasKeysConfigured: boolean;
} {
  return {
    isOperational: isLangfuseOperational(),
    clientInitialized: langfuseClient !== null,
    loadAttempted,
    hasKeysConfigured: Boolean(
      process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
    ),
  };
}

export async function initializeLangfuseClient(): Promise<void> {
  if (langfuseClient) {
    return;
  }

  await ensureInitPromise();
}

export async function enableLangfuseTestMode(): Promise<void> {
  setLangfuseTestModeEnabled(true);
  logger.info('[Langfuse] 테스트 모드 활성화 - 100% 추적, 즉시 플러시');
  await reinitializeLangfuse();
}

export async function disableLangfuseTestMode(): Promise<void> {
  setLangfuseTestModeEnabled(false);
  logger.info('[Langfuse] 테스트 모드 비활성화 - 기본 샘플링, 배치 플러시 복귀');
  await reinitializeLangfuse();
}

export async function flushLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.flushAsync();
  }
}

export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
    initPromise = null;
    langfuseOperational = false;
  }
}
