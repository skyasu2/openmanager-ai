import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CircuitBreakerEvent } from './events';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

function createEvent(
  overrides: Partial<CircuitBreakerEvent> = {}
): CircuitBreakerEvent {
  return {
    type: 'failure',
    service: 'test-service',
    timestamp: Date.now(),
    details: {},
    ...overrides,
  };
}

describe('CircuitBreakerEventEmitter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('subscribe receives emitted events', async () => {
    const { circuitBreakerEvents } = await import('./events');
    const received: CircuitBreakerEvent[] = [];
    circuitBreakerEvents.subscribe((e) => received.push(e));

    const event = createEvent({ type: 'circuit_open', service: 'api' });
    circuitBreakerEvents.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('unsubscribe stops receiving events', async () => {
    const { circuitBreakerEvents } = await import('./events');
    const received: CircuitBreakerEvent[] = [];
    const unsubscribe = circuitBreakerEvents.subscribe((e) => received.push(e));

    circuitBreakerEvents.emit(createEvent());
    expect(received).toHaveLength(1);

    unsubscribe();
    circuitBreakerEvents.emit(createEvent());
    expect(received).toHaveLength(1);
  });

  it('emit stores events in history', async () => {
    const { circuitBreakerEvents } = await import('./events');
    const event = createEvent({ service: 'db' });
    circuitBreakerEvents.emit(event);

    const history = circuitBreakerEvents.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(event);
  });

  it('getHistory filters by service', async () => {
    const { circuitBreakerEvents } = await import('./events');
    circuitBreakerEvents.emit(createEvent({ service: 'api' }));
    circuitBreakerEvents.emit(createEvent({ service: 'db' }));
    circuitBreakerEvents.emit(createEvent({ service: 'api' }));

    const filtered = circuitBreakerEvents.getHistory({ service: 'api' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.service === 'api')).toBe(true);
  });

  it('getHistory filters by type', async () => {
    const { circuitBreakerEvents } = await import('./events');
    circuitBreakerEvents.emit(createEvent({ type: 'failure' }));
    circuitBreakerEvents.emit(createEvent({ type: 'success' }));
    circuitBreakerEvents.emit(createEvent({ type: 'failure' }));

    const filtered = circuitBreakerEvents.getHistory({ type: 'failure' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((e) => e.type === 'failure')).toBe(true);
  });

  it('getHistory limits results', async () => {
    const { circuitBreakerEvents } = await import('./events');
    for (let i = 0; i < 10; i++) {
      circuitBreakerEvents.emit(createEvent({ service: `svc-${i}` }));
    }

    const limited = circuitBreakerEvents.getHistory({ limit: 3 });
    expect(limited).toHaveLength(3);
    expect(limited[0].service).toBe('svc-7');
    expect(limited[2].service).toBe('svc-9');
  });

  it('getRecentEvents returns last N events', async () => {
    const { circuitBreakerEvents } = await import('./events');
    for (let i = 0; i < 20; i++) {
      circuitBreakerEvents.emit(createEvent({ service: `svc-${i}` }));
    }

    const recent = circuitBreakerEvents.getRecentEvents(5);
    expect(recent).toHaveLength(5);
    expect(recent[0].service).toBe('svc-15');
    expect(recent[4].service).toBe('svc-19');
  });

  it('clearHistory empties history', async () => {
    const { circuitBreakerEvents } = await import('./events');
    circuitBreakerEvents.emit(createEvent());
    circuitBreakerEvents.emit(createEvent());
    expect(circuitBreakerEvents.getHistory()).toHaveLength(2);

    circuitBreakerEvents.clearHistory();
    expect(circuitBreakerEvents.getHistory()).toHaveLength(0);
  });

  it('history caps at 100 events (maxHistorySize)', async () => {
    const { circuitBreakerEvents } = await import('./events');
    for (let i = 0; i < 110; i++) {
      circuitBreakerEvents.emit(createEvent({ service: `svc-${i}` }));
    }

    const history = circuitBreakerEvents.getHistory();
    expect(history).toHaveLength(100);
    expect(history[0].service).toBe('svc-10');
    expect(history[99].service).toBe('svc-109');
  });

  it('listener error is caught and logged without crashing other listeners', async () => {
    const { circuitBreakerEvents } = await import('./events');
    const errorListener = (): never => {
      throw new Error('listener boom');
    };
    const received: CircuitBreakerEvent[] = [];
    const goodListener = (e: CircuitBreakerEvent): void => {
      received.push(e);
    };

    circuitBreakerEvents.subscribe(errorListener);
    circuitBreakerEvents.subscribe(goodListener);

    const event = createEvent();
    circuitBreakerEvents.emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[CircuitBreaker] Event listener error:',
      expect.any(Error)
    );
  });

  it('emit logs in development mode', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const { circuitBreakerEvents } = await import('./events');
      const event = createEvent({
        type: 'failover',
        service: 'redis',
        details: { failoverFrom: 'primary', failoverTo: 'replica' },
      });
      circuitBreakerEvents.emit(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[CircuitBreaker] failover - redis:',
        event.details
      );
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
