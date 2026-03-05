import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type SystemEvent,
  SystemEventType,
} from '../interfaces/SystemEventBus';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

import { SystemEventBus } from './SystemEventHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEvent(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    type: SystemEventType.PROCESS_STARTED,
    timestamp: Date.now(),
    source: 'test',
    payload: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SystemEventBus
// ---------------------------------------------------------------------------

describe('SystemEventBus', () => {
  let bus: SystemEventBus;

  beforeEach(() => {
    bus = new SystemEventBus();
    vi.clearAllMocks();
  });

  // --- construction defaults ---

  describe('construction', () => {
    it('uses correct default config values', () => {
      // Verify defaults by observing behaviour:
      // enableHistory=true  -> getHistory works
      // historyLimit=100    -> tested separately
      // enableDebugLogging=false -> logger.info not called on emit
      const event = createEvent();
      bus.emit(event);

      expect(bus.getHistory()).toHaveLength(1);
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });

  // --- emit ---

  describe('emit', () => {
    it('triggers subscribed listeners', () => {
      const listener = vi.fn();
      bus.on(SystemEventType.PROCESS_STARTED, listener);

      const event = createEvent();
      bus.emit(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  // --- on ---

  describe('on', () => {
    it('receives events of the subscribed type only', () => {
      const listener = vi.fn();
      bus.on(SystemEventType.PROCESS_STARTED, listener);

      bus.emit(createEvent({ type: SystemEventType.PROCESS_STARTED }));
      bus.emit(createEvent({ type: SystemEventType.PROCESS_STOPPED }));
      bus.emit(createEvent({ type: SystemEventType.PROCESS_STARTED }));

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  // --- off ---

  describe('off', () => {
    it('removes listener so it stops receiving events', () => {
      const listener = vi.fn();
      bus.on(SystemEventType.PROCESS_STARTED, listener);

      bus.emit(createEvent());
      expect(listener).toHaveBeenCalledTimes(1);

      bus.off(SystemEventType.PROCESS_STARTED, listener);
      bus.emit(createEvent());
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // --- once ---

  describe('once', () => {
    it('fires listener only once then auto-unsubscribes', () => {
      const listener = vi.fn();
      bus.once(SystemEventType.PROCESS_STARTED, listener);

      bus.emit(createEvent());
      bus.emit(createEvent());
      bus.emit(createEvent());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(0);
    });
  });

  // --- removeAllListeners ---

  describe('removeAllListeners', () => {
    it('clears all listeners when called without arguments', () => {
      bus.on(SystemEventType.PROCESS_STARTED, vi.fn());
      bus.on(SystemEventType.PROCESS_STOPPED, vi.fn());
      bus.on(SystemEventType.WATCHDOG_ALERT, vi.fn());

      bus.removeAllListeners();

      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(0);
      expect(bus.listenerCount(SystemEventType.PROCESS_STOPPED)).toBe(0);
      expect(bus.listenerCount(SystemEventType.WATCHDOG_ALERT)).toBe(0);
    });

    it('clears only the specified event type', () => {
      bus.on(SystemEventType.PROCESS_STARTED, vi.fn());
      bus.on(SystemEventType.PROCESS_STOPPED, vi.fn());

      bus.removeAllListeners(SystemEventType.PROCESS_STARTED);

      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(0);
      expect(bus.listenerCount(SystemEventType.PROCESS_STOPPED)).toBe(1);
    });
  });

  // --- listenerCount ---

  describe('listenerCount', () => {
    it('returns the correct count', () => {
      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(0);

      const l1 = vi.fn();
      const l2 = vi.fn();
      bus.on(SystemEventType.PROCESS_STARTED, l1);
      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(1);

      bus.on(SystemEventType.PROCESS_STARTED, l2);
      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(2);

      bus.off(SystemEventType.PROCESS_STARTED, l1);
      expect(bus.listenerCount(SystemEventType.PROCESS_STARTED)).toBe(1);
    });
  });

  // --- getHistory ---

  describe('getHistory', () => {
    it('returns all emitted events', () => {
      const e1 = createEvent({ source: 'a' });
      const e2 = createEvent({ source: 'b' });

      bus.emit(e1);
      bus.emit(e2);

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(e1);
      expect(history[1]).toEqual(e2);
    });

    it('filters by event type', () => {
      bus.emit(createEvent({ type: SystemEventType.PROCESS_STARTED }));
      bus.emit(createEvent({ type: SystemEventType.PROCESS_STOPPED }));
      bus.emit(createEvent({ type: SystemEventType.PROCESS_STARTED }));

      const filtered = bus.getHistory(SystemEventType.PROCESS_STARTED);
      expect(filtered).toHaveLength(2);
      filtered.forEach((e) => {
        expect(e.type).toBe(SystemEventType.PROCESS_STARTED);
      });
    });

    it('returns last N events when limit is provided', () => {
      for (let i = 0; i < 10; i++) {
        bus.emit(createEvent({ source: `s${i}` }));
      }

      const last3 = bus.getHistory(undefined, 3);
      expect(last3).toHaveLength(3);
      expect(last3[0].source).toBe('s7');
      expect(last3[1].source).toBe('s8');
      expect(last3[2].source).toBe('s9');
    });

    it('applies type filter and limit together', () => {
      for (let i = 0; i < 5; i++) {
        bus.emit(
          createEvent({
            type: SystemEventType.PROCESS_STARTED,
            source: `started-${i}`,
          })
        );
        bus.emit(
          createEvent({
            type: SystemEventType.PROCESS_STOPPED,
            source: `stopped-${i}`,
          })
        );
      }

      const result = bus.getHistory(SystemEventType.PROCESS_STARTED, 2);
      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('started-3');
      expect(result[1].source).toBe('started-4');
    });
  });

  // --- history cap ---

  describe('history limit', () => {
    it('caps at historyLimit (default 100)', () => {
      for (let i = 0; i < 120; i++) {
        bus.emit(createEvent({ source: `e${i}` }));
      }

      const history = bus.getHistory();
      expect(history).toHaveLength(100);
      // Oldest kept should be e20 (first 20 were shifted out)
      expect(history[0].source).toBe('e20');
      expect(history[99].source).toBe('e119');
    });

    it('respects custom historyLimit', () => {
      const smallBus = new SystemEventBus({ historyLimit: 5 });

      for (let i = 0; i < 10; i++) {
        smallBus.emit(createEvent({ source: `e${i}` }));
      }

      const history = smallBus.getHistory();
      expect(history).toHaveLength(5);
      expect(history[0].source).toBe('e5');
    });
  });

  // --- error handling ---

  describe('listener error handling', () => {
    it('catches listener errors without crashing other listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('boom');
      });
      const goodListener = vi.fn();

      bus.on(SystemEventType.PROCESS_STARTED, errorListener);
      bus.on(SystemEventType.PROCESS_STARTED, goodListener);

      // Should not throw
      expect(() => bus.emit(createEvent())).not.toThrow();

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  // --- enableHistory=false ---

  describe('enableHistory=false', () => {
    it('skips history recording', () => {
      const noHistoryBus = new SystemEventBus({ enableHistory: false });

      noHistoryBus.emit(createEvent());
      noHistoryBus.emit(createEvent());

      expect(noHistoryBus.getHistory()).toHaveLength(0);
    });
  });

  // --- enableDebugLogging=true ---

  describe('enableDebugLogging=true', () => {
    it('logs emitted events', () => {
      const debugBus = new SystemEventBus({ enableDebugLogging: true });

      const event = createEvent({ type: SystemEventType.WATCHDOG_ALERT });
      debugBus.emit(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(SystemEventType.WATCHDOG_ALERT),
        event
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton functions
// ---------------------------------------------------------------------------

describe('singleton functions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('getSystemEventMediator returns the same instance', async () => {
    const mod = await import('./SystemEventHandler');
    const a = mod.getSystemEventMediator();
    const b = mod.getSystemEventMediator();
    expect(a).toBe(b);
  });

  it('getSystemEventBus returns the mediator event bus', async () => {
    const mod = await import('./SystemEventHandler');
    const mediator = mod.getSystemEventMediator();
    const bus = mod.getSystemEventBus();
    expect(bus).toBe(mediator.getEventBus());
  });
});
