import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('LOG_LEVEL_PRIORITY', () => {
  it('has correct priority ordering', async () => {
    const { LOG_LEVEL_PRIORITY } = await import('./config');

    expect(LOG_LEVEL_PRIORITY.debug).toBe(0);
    expect(LOG_LEVEL_PRIORITY.info).toBe(1);
    expect(LOG_LEVEL_PRIORITY.warn).toBe(2);
    expect(LOG_LEVEL_PRIORITY.error).toBe(3);
    expect(LOG_LEVEL_PRIORITY.silent).toBe(4);

    expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
    expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
    expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
    expect(LOG_LEVEL_PRIORITY.error).toBeLessThan(LOG_LEVEL_PRIORITY.silent);
  });
});

describe('getLogLevel (via loggerConfig.level)', () => {
  it('returns silent when NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('LOG_LEVEL', '');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.level).toBe('silent');
  });

  it('returns debug when NODE_ENV=development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOG_LEVEL', '');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.level).toBe('debug');
  });

  it('returns info when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', '');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.level).toBe('info');
  });

  it('returns explicit LOG_LEVEL env var when set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.level).toBe('warn');
  });
});

describe('loggerConfig.prettyPrint', () => {
  it('is true when NODE_ENV=development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.prettyPrint).toBe(true);
  });

  it('is false when NODE_ENV=production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.prettyPrint).toBe(false);
  });
});

describe('loggerConfig.base', () => {
  it('includes env from NODE_ENV', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.base.env).toBe('production');
  });

  it('includes version from APP_VERSION', async () => {
    vi.stubEnv('APP_VERSION', '1.2.3');
    const { loggerConfig } = await import('./config');
    expect(loggerConfig.base.version).toBe('1.2.3');
  });
});

describe('shouldLog', () => {
  it('with level=silent (default test env), only silent returns true', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('LOG_LEVEL', '');
    const { shouldLog, loggerConfig } = await import('./config');

    expect(loggerConfig.level).toBe('silent');
    expect(shouldLog('debug')).toBe(false);
    expect(shouldLog('info')).toBe(false);
    expect(shouldLog('warn')).toBe(false);
    expect(shouldLog('error')).toBe(false);
    expect(shouldLog('silent')).toBe(true);
  });

  it('with level=debug, all levels return true', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LOG_LEVEL', '');
    const { shouldLog, loggerConfig } = await import('./config');

    expect(loggerConfig.level).toBe('debug');
    expect(shouldLog('debug')).toBe(true);
    expect(shouldLog('info')).toBe(true);
    expect(shouldLog('warn')).toBe(true);
    expect(shouldLog('error')).toBe(true);
    expect(shouldLog('silent')).toBe(true);
  });

  it('with level=warn, only warn/error/silent return true', async () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { shouldLog, loggerConfig } = await import('./config');

    expect(loggerConfig.level).toBe('warn');
    expect(shouldLog('debug')).toBe(false);
    expect(shouldLog('info')).toBe(false);
    expect(shouldLog('warn')).toBe(true);
    expect(shouldLog('error')).toBe(true);
    expect(shouldLog('silent')).toBe(true);
  });

  it('with level=error, only error/silent return true', async () => {
    vi.stubEnv('LOG_LEVEL', 'error');
    const { shouldLog, loggerConfig } = await import('./config');

    expect(loggerConfig.level).toBe('error');
    expect(shouldLog('debug')).toBe(false);
    expect(shouldLog('info')).toBe(false);
    expect(shouldLog('warn')).toBe(false);
    expect(shouldLog('error')).toBe(true);
    expect(shouldLog('silent')).toBe(true);
  });
});
