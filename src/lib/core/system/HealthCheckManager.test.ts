import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSystemLogger } = vi.hoisted(() => ({
  mockSystemLogger: {
    system: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ systemLogger: mockSystemLogger }));
vi.mock('./process-types', () => ({}));

import {
  type HealthCheckContext,
  HealthCheckManager,
} from './HealthCheckManager';
import type { ProcessConfig, ProcessState } from './process-types';

function createConfig(overrides: Partial<ProcessConfig> = {}): ProcessConfig {
  return {
    id: 'proc-1',
    name: 'TestProcess',
    startCommand: vi.fn(async () => {}),
    stopCommand: vi.fn(async () => {}),
    healthCheck: vi.fn(async () => true),
    criticalLevel: 'medium' as const,
    autoRestart: true,
    maxRestarts: 3,
    ...overrides,
  };
}

function createState(overrides: Partial<ProcessState> = {}): ProcessState {
  return {
    id: 'proc-1',
    status: 'running' as const,
    restartCount: 0,
    errors: [],
    uptime: 1000,
    healthScore: 80,
    ...overrides,
  };
}

function createCtx(
  overrides: Partial<HealthCheckContext> = {}
): HealthCheckContext {
  const config = createConfig();
  const state = createState();
  return {
    isRunning: vi.fn(() => true),
    getProcessIds: vi.fn(() => ['proc-1']),
    getProcess: vi.fn(() => config) as (
      ...args: never
    ) => unknown as HealthCheckContext['getProcess'],
    getState: vi.fn(() => state) as (
      ...args: never
    ) => unknown as HealthCheckContext['getState'],
    getEventBus: vi.fn(() => undefined),
    emitEvent: vi.fn(),
    ...overrides,
  };
}

describe('HealthCheckManager', () => {
  let manager: HealthCheckManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    manager = new HealthCheckManager(5000);
  });

  afterEach(() => {
    manager.stopHealthChecks();
    vi.useRealTimers();
  });

  describe('performHealthCheck', () => {
    it('skips when not running', async () => {
      const ctx = createCtx({ isRunning: vi.fn(() => false) });
      await manager.performHealthCheck('proc-1', ctx);
      expect(ctx.getProcess).not.toHaveBeenCalled();
    });

    it('skips when config not found', async () => {
      const ctx = createCtx({
        getProcess: vi.fn(() => undefined),
      });
      await manager.performHealthCheck('proc-1', ctx);
      expect(ctx.emitEvent).not.toHaveBeenCalled();
    });

    it('skips when state not found', async () => {
      const ctx = createCtx({
        getState: vi.fn(() => undefined),
      });
      await manager.performHealthCheck('proc-1', ctx);
      expect(ctx.emitEvent).not.toHaveBeenCalled();
    });

    it('skips when process status is not running', async () => {
      const config = createConfig();
      const state = createState({ status: 'stopped' });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });
      await manager.performHealthCheck('proc-1', ctx);
      expect(config.healthCheck).not.toHaveBeenCalled();
    });

    it('increases healthScore by 5 on healthy check (capped at 100)', async () => {
      const state = createState({ healthScore: 97 });
      const config = createConfig({ healthCheck: vi.fn(async () => true) });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      await manager.performHealthCheck('proc-1', ctx);
      expect(state.healthScore).toBe(100);
    });

    it('decreases healthScore by 20 on unhealthy check (min 0)', async () => {
      const state = createState({ healthScore: 10 });
      const config = createConfig({ healthCheck: vi.fn(async () => false) });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      await manager.performHealthCheck('proc-1', ctx);
      expect(state.healthScore).toBe(0);
    });

    it('emits process:unhealthy when healthScore drops below 50', async () => {
      const state = createState({ healthScore: 60 });
      const config = createConfig({ healthCheck: vi.fn(async () => false) });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      await manager.performHealthCheck('proc-1', ctx);
      // 60 - 20 = 40 < 50
      expect(ctx.emitEvent).toHaveBeenCalledWith('process:unhealthy', {
        processId: 'proc-1',
        healthScore: 40,
      });
    });

    it('logs warning when healthScore drops below 50', async () => {
      const state = createState({ healthScore: 60 });
      const config = createConfig({ healthCheck: vi.fn(async () => false) });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      await manager.performHealthCheck('proc-1', ctx);
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('TestProcess')
      );
    });

    it('decreases healthScore by 30 on healthCheck exception', async () => {
      const state = createState({ healthScore: 80 });
      const config = createConfig({
        healthCheck: vi.fn(async () => {
          throw new Error('check failed');
        }),
      });
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      await manager.performHealthCheck('proc-1', ctx);
      expect(state.healthScore).toBe(50);
      expect(mockSystemLogger.error).toHaveBeenCalled();
    });

    it('sets lastHealthCheck date', async () => {
      const state = createState();
      const config = createConfig();
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      const now = new Date('2026-03-06T12:00:00Z');
      vi.setSystemTime(now);

      await manager.performHealthCheck('proc-1', ctx);
      expect(state.lastHealthCheck).toEqual(now);
    });
  });

  describe('startHealthChecks', () => {
    it('starts interval when system is running', async () => {
      const config = createConfig();
      const state = createState();
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      manager.startHealthChecks(ctx);
      expect(mockSystemLogger.system).toHaveBeenCalledWith(
        expect.stringContaining('헬스체크 시작')
      );

      // Advance timer to trigger the interval
      await vi.advanceTimersByTimeAsync(5000);
      expect(config.healthCheck).toHaveBeenCalled();
    });

    it('logs warning and skips when not running', () => {
      const ctx = createCtx({ isRunning: vi.fn(() => false) });
      manager.startHealthChecks(ctx);
      expect(mockSystemLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('시스템이 실행 중이 아니므로')
      );
    });

    it('clears previous interval before starting new one', async () => {
      const config = createConfig();
      const state = createState();
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      manager.startHealthChecks(ctx);
      manager.startHealthChecks(ctx);

      // Only one interval should fire after 5s
      await vi.advanceTimersByTimeAsync(5000);
      expect(config.healthCheck).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopHealthChecks', () => {
    it('clears interval', async () => {
      const config = createConfig();
      const state = createState();
      const ctx = createCtx({
        getProcess: vi.fn(() => config),
        getState: vi.fn(() => state),
      });

      manager.startHealthChecks(ctx);
      manager.stopHealthChecks();

      await vi.advanceTimersByTimeAsync(5000);
      expect(config.healthCheck).not.toHaveBeenCalled();
    });

    it('logs stop message', () => {
      const ctx = createCtx();
      manager.startHealthChecks(ctx);
      vi.clearAllMocks();

      manager.stopHealthChecks();
      expect(mockSystemLogger.system).toHaveBeenCalledWith(
        expect.stringContaining('헬스체크 중지됨')
      );
    });

    it('is safe to call when no interval exists', () => {
      expect(() => manager.stopHealthChecks()).not.toThrow();
      expect(mockSystemLogger.system).not.toHaveBeenCalled();
    });
  });

  describe('performInitialHealthCheck', () => {
    it('returns true on first healthy check', async () => {
      const config = createConfig({ healthCheck: vi.fn(async () => true) });
      const result = await manager.performInitialHealthCheck(config);
      expect(result).toBe(true);
      expect(config.healthCheck).toHaveBeenCalledTimes(1);
    });

    it('retries up to 3 times', async () => {
      const config = createConfig({ healthCheck: vi.fn(async () => false) });

      const promise = manager.performInitialHealthCheck(config);
      // Advance through the 1000ms delays between retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe(false);
      expect(config.healthCheck).toHaveBeenCalledTimes(3);
    });

    it('returns false after 3 failed attempts', async () => {
      const config = createConfig({
        healthCheck: vi.fn(async () => {
          throw new Error('fail');
        }),
      });

      const promise = manager.performInitialHealthCheck(config);
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;
      expect(result).toBe(false);
      expect(mockSystemLogger.warn).toHaveBeenCalledTimes(3);
    });

    it('returns true if second attempt succeeds', async () => {
      let callCount = 0;
      const config = createConfig({
        healthCheck: vi.fn(async () => {
          callCount++;
          if (callCount === 1) return false;
          return true;
        }),
      });

      const promise = manager.performInitialHealthCheck(config);
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBe(true);
      expect(config.healthCheck).toHaveBeenCalledTimes(2);
    });
  });
});
