import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSystemLogger } = vi.hoisted(() => ({
  mockSystemLogger: { system: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  systemLogger: mockSystemLogger,
}));

vi.mock('./process-types', () => ({}));

import { SystemStabilityMonitor } from './SystemStabilityMonitor';
import type { StabilityContext } from './SystemStabilityMonitor';

describe('SystemStabilityMonitor', () => {
  const SHORT_TIMEOUT = 100;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  function makeCtx(
    overrides: Partial<StabilityContext> = {},
  ): StabilityContext {
    return {
      getSystemMetrics: vi.fn(() => ({
        totalProcesses: 5,
        healthyProcesses: 5,
        unhealthyProcesses: 0,
        uptime: 1000,
      })),
      emitEvent: vi.fn(),
      ...overrides,
    };
  }

  describe('constructor', () => {
    it('default timeout is 30 minutes', () => {
      const monitor = new SystemStabilityMonitor();
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);

      // Should not fire before 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000 - 1);
      expect(ctx.emitEvent).not.toHaveBeenCalled();

      // Should fire at exactly 30 minutes
      vi.advanceTimersByTime(1);
      expect(ctx.emitEvent).toHaveBeenCalled();

      monitor.clearStabilityTimeout();
    });

    it('accepts custom timeout value', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);

      vi.advanceTimersByTime(SHORT_TIMEOUT - 1);
      expect(ctx.emitEvent).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(ctx.emitEvent).toHaveBeenCalled();

      monitor.clearStabilityTimeout();
    });
  });

  describe('setupStabilityMonitoring', () => {
    it('does not fire immediately', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);

      expect(ctx.getSystemMetrics).not.toHaveBeenCalled();
      expect(ctx.emitEvent).not.toHaveBeenCalled();

      monitor.clearStabilityTimeout();
    });

    it('fires callback after timeout elapses', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);
      vi.advanceTimersByTime(SHORT_TIMEOUT);

      expect(ctx.getSystemMetrics).toHaveBeenCalledTimes(1);

      monitor.clearStabilityTimeout();
    });

    it('calls emitEvent with system:stable when healthyProcesses === totalProcesses', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const metrics = {
        totalProcesses: 3,
        healthyProcesses: 3,
        unhealthyProcesses: 0,
        uptime: 2000,
      };
      const ctx = makeCtx({
        getSystemMetrics: vi.fn(() => metrics),
      });

      monitor.setupStabilityMonitoring(ctx);
      vi.advanceTimersByTime(SHORT_TIMEOUT);

      expect(ctx.emitEvent).toHaveBeenCalledWith('system:stable', {
        metrics,
        duration: 30,
      });

      monitor.clearStabilityTimeout();
    });

    it('calls systemLogger.system when stable', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);
      vi.advanceTimersByTime(SHORT_TIMEOUT);

      expect(mockSystemLogger.system).toHaveBeenCalledTimes(1);

      monitor.clearStabilityTimeout();
    });

    it('does NOT call emitEvent when healthyProcesses !== totalProcesses', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx({
        getSystemMetrics: vi.fn(() => ({
          totalProcesses: 5,
          healthyProcesses: 3,
          unhealthyProcesses: 2,
          uptime: 1000,
        })),
      });

      monitor.setupStabilityMonitoring(ctx);
      vi.advanceTimersByTime(SHORT_TIMEOUT);

      expect(ctx.emitEvent).not.toHaveBeenCalled();
      expect(mockSystemLogger.system).not.toHaveBeenCalled();

      monitor.clearStabilityTimeout();
    });

    it('clears previous timeout before setting new one', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx1 = makeCtx();
      const ctx2 = makeCtx();

      // Setup first monitoring
      monitor.setupStabilityMonitoring(ctx1);

      // Advance partway
      vi.advanceTimersByTime(SHORT_TIMEOUT / 2);

      // Setup second monitoring (should clear the first)
      monitor.setupStabilityMonitoring(ctx2);

      // Advance past the original timeout
      vi.advanceTimersByTime(SHORT_TIMEOUT / 2 + 1);

      // First context should never have fired
      expect(ctx1.emitEvent).not.toHaveBeenCalled();

      // Second context should not have fired yet (only half elapsed since reset)
      expect(ctx2.emitEvent).not.toHaveBeenCalled();

      // Advance the remaining time for the second setup
      vi.advanceTimersByTime(SHORT_TIMEOUT / 2);

      // Now the second context should have fired
      expect(ctx2.emitEvent).toHaveBeenCalled();

      monitor.clearStabilityTimeout();
    });
  });

  describe('clearStabilityTimeout', () => {
    it('clears timeout so callback never fires', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);
      monitor.clearStabilityTimeout();

      vi.advanceTimersByTime(SHORT_TIMEOUT * 10);

      expect(ctx.getSystemMetrics).not.toHaveBeenCalled();
      expect(ctx.emitEvent).not.toHaveBeenCalled();
    });

    it('is safe to call when no timeout exists', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);

      expect(() => monitor.clearStabilityTimeout()).not.toThrow();
    });

    it('calling clear twice is safe', () => {
      const monitor = new SystemStabilityMonitor(SHORT_TIMEOUT);
      const ctx = makeCtx();

      monitor.setupStabilityMonitoring(ctx);

      expect(() => {
        monitor.clearStabilityTimeout();
        monitor.clearStabilityTimeout();
      }).not.toThrow();

      vi.advanceTimersByTime(SHORT_TIMEOUT * 10);
      expect(ctx.emitEvent).not.toHaveBeenCalled();
    });
  });
});
