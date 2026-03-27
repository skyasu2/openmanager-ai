/**
 * approval-store.ts Unit Tests
 * Updated for async methods (Redis integration)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { approvalStore } from './approval-store';

describe('ApprovalStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Use public reset method for testing
    approvalStore._resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerPending', () => {
    it('should register a pending approval', async () => {
      const sessionId = 'test-session-1';
      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test approval',
        payload: { test: true },
        requestedAt: new Date(),
        requestedBy: 'test-agent',
      });

      expect(await approvalStore.hasPending(sessionId)).toBe(true);
    });

    it('should set correct expiry time', async () => {
      const sessionId = 'test-session-2';
      const now = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(now);

      await approvalStore.registerPending({
        sessionId,
        actionType: 'system_command',
        description: 'Test',
        payload: {},
        requestedAt: now,
        requestedBy: 'agent',
      });

      const pending = await approvalStore.getPending(sessionId);
      expect(pending).not.toBeNull();
      expect(pending!.expiresAt.getTime()).toBe(now.getTime() + 5 * 60 * 1000);
    });
  });

  describe('getPending', () => {
    it('should return null for non-existent session', async () => {
      expect(await approvalStore.getPending('non-existent')).toBeNull();
    });

    it('should return null for expired approval', async () => {
      const sessionId = 'test-session-expired';
      const now = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(now);

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: now,
        requestedBy: 'agent',
      });

      // Advance time past expiry
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(await approvalStore.getPending(sessionId)).toBeNull();
    });

    it('should return null for already decided approval', async () => {
      const sessionId = 'test-session-decided';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'critical_alert',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      await approvalStore.submitDecision(sessionId, true);

      expect(await approvalStore.getPending(sessionId)).toBeNull();
    });
  });

  describe('submitDecision', () => {
    it('should submit approval decision', async () => {
      const sessionId = 'test-session-approve';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      const result = await approvalStore.submitDecision(sessionId, true, {
        reason: 'Approved by user',
        decidedBy: 'user-1',
      });

      expect(result).toBe(true);
      const decision = await approvalStore.getDecision(sessionId);
      expect(decision).not.toBeNull();
      expect(decision!.approved).toBe(true);
      expect(decision!.reason).toBe('Approved by user');
    });

    it('should submit rejection decision', async () => {
      const sessionId = 'test-session-reject';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'system_command',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      const result = await approvalStore.submitDecision(sessionId, false, {
        reason: 'Rejected by user',
      });

      expect(result).toBe(true);
      const decision = await approvalStore.getDecision(sessionId);
      expect(decision!.approved).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const result = await approvalStore.submitDecision('non-existent', true);
      expect(result).toBe(false);
    });

    it('should return false for already decided session', async () => {
      const sessionId = 'test-session-double';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      await approvalStore.submitDecision(sessionId, true);
      const secondResult = await approvalStore.submitDecision(sessionId, false);

      expect(secondResult).toBe(false);
    });
  });

  describe('waitForDecision', () => {
    it('should resolve immediately if already decided', async () => {
      const sessionId = 'test-session-immediate';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      await approvalStore.submitDecision(sessionId, true);

      const decision = await approvalStore.waitForDecision(sessionId);
      expect(decision.approved).toBe(true);
    });

    it('should reject for non-existent session', async () => {
      await expect(
        approvalStore.waitForDecision('non-existent')
      ).rejects.toThrow('No pending approval');
    });

    it('should resolve when decision is submitted', async () => {
      const sessionId = 'test-session-async';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      const waitPromise = approvalStore.waitForDecision(sessionId);

      // Simulate user decision after short delay
      setTimeout(async () => {
        await approvalStore.submitDecision(sessionId, true);
      }, 100);

      vi.advanceTimersByTime(100);

      const decision = await waitPromise;
      expect(decision.approved).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', async () => {
      await approvalStore.registerPending({
        sessionId: 'stats-1',
        actionType: 'incident_report',
        description: 'Test 1',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      await approvalStore.registerPending({
        sessionId: 'stats-2',
        actionType: 'system_command',
        description: 'Test 2',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      await approvalStore.submitDecision('stats-1', true);

      const stats = approvalStore.getStats();
      expect(stats.pending).toBe(1);
      expect(stats.total).toBe(2);
      // New: check redisEnabled flag
      expect(typeof stats.redisEnabled).toBe('boolean');
    });
  });

  describe('auto-cleanup', () => {
    it('should auto-cleanup after TTL', async () => {
      const sessionId = 'test-auto-cleanup';

      await approvalStore.registerPending({
        sessionId,
        actionType: 'incident_report',
        description: 'Test',
        payload: {},
        requestedAt: new Date(),
        requestedBy: 'agent',
      });

      expect(await approvalStore.hasPending(sessionId)).toBe(true);

      // Advance past TTL
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(await approvalStore.hasPending(sessionId)).toBe(false);
    });
  });
});
