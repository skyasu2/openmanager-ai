import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSystemRunningFlag: vi.fn(),
  setSystemRunningFlag: vi.fn(),
  getSystemStatus: vi.fn(),
  startSystem: vi.fn(),
  stopSystem: vi.fn(),
  registerProcess: vi.fn(),
  ProcessManager: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: <T extends (...args: never[]) => unknown>(handler: T) => handler,
}));

vi.mock('@/lib/redis', () => ({
  getSystemRunningFlag: mocks.getSystemRunningFlag,
  setSystemRunningFlag: mocks.setSystemRunningFlag,
}));

vi.mock('@/lib/core/system/process-configs', () => ({
  getProcessConfigs: () => [],
  validateProcessConfigs: () => ({ isValid: true, errors: [] }),
}));

vi.mock('@/lib/core/system/ProcessManager', () => ({
  ProcessManager: mocks.ProcessManager,
}));

vi.mock('@/lib/logger', () => ({
  systemLogger: {
    system: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: vi.fn(),
  },
}));

function makeRequest(action?: string) {
  return new NextRequest('https://openmanager-ai.vercel.app/api/system', {
    method: action ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: action ? JSON.stringify({ action }) : undefined,
  });
}

function mockProcessStatus(running: boolean) {
  mocks.getSystemStatus.mockReturnValue({
    running,
    processes: new Map(),
    metrics: {
      totalProcesses: 6,
      runningProcesses: running ? 6 : 0,
      healthyProcesses: running ? 6 : 0,
      systemUptime: 1234,
      averageHealthScore: running ? 100 : 0,
      totalRestarts: 0,
      memoryUsage: 0,
      lastStabilityCheck: new Date().toISOString(),
    },
  });
}

async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

describe('/api/system route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '8.11.162');
    mocks.ProcessManager.mockImplementation(function MockProcessManager() {
      return {
        registerProcess: mocks.registerProcess,
        getSystemStatus: mocks.getSystemStatus,
        startSystem: mocks.startSystem,
        stopSystem: mocks.stopSystem,
      };
    });
    mockProcessStatus(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Vercel 서버리스 start는 ProcessManager 시작 대신 Redis 실행 플래그를 켠다', async () => {
    mocks.setSystemRunningFlag.mockResolvedValue(true);
    const { POST } = await loadRoute();

    const response = await POST(makeRequest('start'));
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      action: 'start',
      warnings: ['SERVERLESS_VIRTUAL_SYSTEM_STATE'],
    });
    expect(mocks.setSystemRunningFlag).toHaveBeenCalledWith(true);
    expect(mocks.startSystem).not.toHaveBeenCalled();
    expect(mocks.ProcessManager).not.toHaveBeenCalled();
  });

  it('Vercel 서버리스 stop은 Redis 실행 플래그를 끈다', async () => {
    mocks.setSystemRunningFlag.mockResolvedValue(true);
    const { POST } = await loadRoute();

    const response = await POST(makeRequest('stop'));
    const body = await response.json();

    expect(body).toMatchObject({
      success: true,
      action: 'stop',
      warnings: ['SERVERLESS_VIRTUAL_SYSTEM_STATE'],
    });
    expect(mocks.setSystemRunningFlag).toHaveBeenCalledWith(false);
    expect(mocks.stopSystem).not.toHaveBeenCalled();
  });

  it('Vercel 서버리스 GET은 ProcessManager보다 Redis 실행 플래그를 우선한다', async () => {
    mockProcessStatus(true);
    mocks.getSystemRunningFlag.mockResolvedValue(false);
    const { GET } = await loadRoute();

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body).toMatchObject({
      isRunning: false,
      systemStateSource: 'redis(serverless,process-mismatch)',
      version: '8.11.162',
    });
  });
});
