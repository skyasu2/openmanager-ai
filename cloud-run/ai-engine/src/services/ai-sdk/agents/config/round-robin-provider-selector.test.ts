import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  selectRoundRobinProviderOrder,
  resetRoundRobinCursor,
  getRoundRobinCursor,
  setRoundRobinCursor,
  type RoundRobinSelection,
} from './round-robin-provider-selector';

// Mock quota-store-memory to control cooldown state per test
vi.mock('../../../resilience/quota-store-memory', () => ({
  getMemoryCooldown: vi.fn(() => null), // default: no cooldown
}));

import { getMemoryCooldown } from '../../../resilience/quota-store-memory';
const mockGetMemoryCooldown = vi.mocked(getMemoryCooldown);

describe('round-robin-provider-selector', () => {
  beforeEach(() => {
    resetRoundRobinCursor();
    mockGetMemoryCooldown.mockReturnValue(null); // no cooldown by default
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('selectRoundRobinProviderOrder — basic rotation', () => {
    it('should rotate providers in round-robin order', () => {
      const first = selectRoundRobinProviderOrder(8_000);
      expect(first.rotationSlot).toBe(0);

      const second = selectRoundRobinProviderOrder(8_000);
      expect(second.rotationSlot).toBe(1);

      const third = selectRoundRobinProviderOrder(8_000);
      expect(third.rotationSlot).toBe(2);

      const fourth = selectRoundRobinProviderOrder(8_000);
      expect(fourth.rotationSlot).toBe(3);

      // Wrap around
      const fifth = selectRoundRobinProviderOrder(8_000);
      expect(fifth.rotationSlot).toBe(0);
    });

    it('should use default 8K context window when not provided', () => {
      const result = selectRoundRobinProviderOrder();
      expect(result.providerOrder.length).toBe(4);
    });

    it('should respect the rotation starting position', () => {
      setRoundRobinCursor(1);
      const result = selectRoundRobinProviderOrder(8_000);
      expect(result.rotationSlot).toBe(1);
      expect(result.providerOrder[0]).toBe('mistral'); // Position 1 in pool
    });
  });

  describe('selectRoundRobinProviderOrder — context guard', () => {
    it('should place all providers in eligible when 8K threshold (all qualify)', () => {
      setRoundRobinCursor(0);
      const result = selectRoundRobinProviderOrder(8_000);
      expect(result.providerOrder).toEqual(['groq', 'mistral', 'zai', 'cerebras']);
    });

    it('should place all providers in eligible when 32K threshold (all qualify)', () => {
      setRoundRobinCursor(0);
      // groq=131K, mistral=32K, zai=128K, cerebras=65K — all ≥ 32K
      const result = selectRoundRobinProviderOrder(32_000);
      expect(result.providerOrder).toEqual(['groq', 'mistral', 'zai', 'cerebras']);
    });

    it('should push context-ineligible providers behind eligible ones', () => {
      setRoundRobinCursor(0);
      // 100K threshold: only groq(131K) and zai(128K) qualify; mistral(32K) and cerebras(65K) don't
      const result = selectRoundRobinProviderOrder(100_000);
      expect(result.providerOrder[0]).toBe('groq');
      expect(result.providerOrder[1]).toBe('zai');
      // ineligible come after
      expect(result.providerOrder).toContain('mistral');
      expect(result.providerOrder).toContain('cerebras');
      expect(result.providerOrder.indexOf('groq')).toBeLessThan(result.providerOrder.indexOf('mistral'));
      expect(result.providerOrder.indexOf('zai')).toBeLessThan(result.providerOrder.indexOf('cerebras'));
    });

    it('should still include all 4 providers even when some are ineligible', () => {
      const result = selectRoundRobinProviderOrder(150_000); // none qualify
      expect(result.providerOrder.length).toBe(4);
    });
  });

  describe('selectRoundRobinProviderOrder — 429 cooldown', () => {
    it('should push cooled providers to the end', () => {
      setRoundRobinCursor(0);
      // groq is in 429 cooldown
      mockGetMemoryCooldown.mockImplementation((provider) =>
        provider === 'groq' ? { until: Date.now() + 60_000, reason: '429' } : null
      );

      const result = selectRoundRobinProviderOrder(8_000);
      // groq should be last
      expect(result.providerOrder[result.providerOrder.length - 1]).toBe('groq');
      // other three come first
      expect(result.providerOrder.slice(0, 3)).toEqual(
        expect.arrayContaining(['mistral', 'zai', 'cerebras'])
      );
    });

    it('should push multiple cooled providers behind non-cooled ones', () => {
      setRoundRobinCursor(0);
      mockGetMemoryCooldown.mockImplementation((provider) =>
        provider === 'groq' || provider === 'mistral'
          ? { until: Date.now() + 60_000, reason: '429' }
          : null
      );

      const result = selectRoundRobinProviderOrder(8_000);
      const cooledIdx = Math.min(
        result.providerOrder.indexOf('groq'),
        result.providerOrder.indexOf('mistral')
      );
      const notCooledIdx = Math.max(
        result.providerOrder.indexOf('zai'),
        result.providerOrder.indexOf('cerebras')
      );
      // All non-cooled come before any cooled
      expect(notCooledIdx).toBeLessThan(cooledIdx);
    });

    it('should include all providers even when all are cooled', () => {
      mockGetMemoryCooldown.mockReturnValue({ until: Date.now() + 60_000, reason: '429' });
      const result = selectRoundRobinProviderOrder(8_000);
      expect(result.providerOrder.length).toBe(4);
    });

    it('should prioritize non-cooled context-ineligible over cooled context-eligible', () => {
      setRoundRobinCursor(0);
      // groq is cooled but has 131K context; mistral is not cooled but only 32K context
      // threshold=100K → mistral is context-ineligible but not cooled
      mockGetMemoryCooldown.mockImplementation((provider) =>
        provider === 'groq' ? { until: Date.now() + 60_000, reason: '429' } : null
      );

      const result = selectRoundRobinProviderOrder(100_000);
      // non-cooled eligible (zai) → non-cooled ineligible (mistral, cerebras) → cooled (groq)
      expect(result.providerOrder[result.providerOrder.length - 1]).toBe('groq');
      expect(result.providerOrder.indexOf('mistral')).toBeLessThan(
        result.providerOrder.indexOf('groq')
      );
    });
  });

  describe('cursor management', () => {
    it('should reset cursor', () => {
      selectRoundRobinProviderOrder();
      selectRoundRobinProviderOrder();
      expect(getRoundRobinCursor()).toBe(2);

      resetRoundRobinCursor();
      expect(getRoundRobinCursor()).toBe(0);
    });

    it('should set cursor to specific position', () => {
      setRoundRobinCursor(2);
      expect(getRoundRobinCursor()).toBe(2);

      const result = selectRoundRobinProviderOrder();
      expect(result.rotationSlot).toBe(2);
    });

    it('should throw on invalid cursor position', () => {
      expect(() => setRoundRobinCursor(-1)).toThrow();
      expect(() => setRoundRobinCursor(4)).toThrow();
    });

    it('should allow valid cursor positions 0-3', () => {
      for (let i = 0; i < 4; i++) {
        expect(() => setRoundRobinCursor(i)).not.toThrow();
        expect(getRoundRobinCursor()).toBe(i);
      }
    });
  });
});
