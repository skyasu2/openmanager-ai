import { beforeEach, describe, expect, it } from 'vitest';

import type { CircuitState } from './state-store';
import { InMemoryStateStore } from './state-store';

function makeState(overrides: Partial<CircuitState> = {}): CircuitState {
  return {
    state: 'CLOSED',
    failures: 0,
    lastFailTime: 0,
    threshold: 5,
    resetTimeout: 30_000,
    ...overrides,
  };
}

describe('InMemoryStateStore', () => {
  let store: InMemoryStateStore;

  beforeEach(() => {
    store = new InMemoryStateStore();
  });

  it('getState returns null for unknown service', async () => {
    const result = await store.getState('unknown-service');
    expect(result).toBeNull();
  });

  it('setState + getState round-trip', async () => {
    const state = makeState({ failures: 3, state: 'OPEN' });
    await store.setState('api-server', state);

    const result = await store.getState('api-server');
    expect(result).toEqual(state);
  });

  it('incrementFailures increments and returns new count', async () => {
    await store.setState('api-server', makeState({ failures: 2 }));

    const count = await store.incrementFailures('api-server');
    expect(count).toBe(3);

    const count2 = await store.incrementFailures('api-server');
    expect(count2).toBe(4);
  });

  it('incrementFailures returns 0 for unknown service', async () => {
    const count = await store.incrementFailures('unknown-service');
    expect(count).toBe(0);
  });

  it('incrementFailures updates lastFailTime', async () => {
    const now = Date.now();
    await store.setState('api-server', makeState({ lastFailTime: 0 }));

    await store.incrementFailures('api-server');

    const result = await store.getState('api-server');
    expect(result!.lastFailTime).toBeGreaterThanOrEqual(now);
  });

  it('resetState removes the service', async () => {
    await store.setState('api-server', makeState());
    await store.resetState('api-server');

    const result = await store.getState('api-server');
    expect(result).toBeNull();
  });
});
