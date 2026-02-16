import { describe, expect, it } from 'vitest';
import { getThreshold } from '@/config/rules';
import type { Server } from '@/types/server';
import { normalizeServerData } from './EnhancedServerModal.utils';

const baseServer: Server = {
  id: 'web-01',
  name: 'Web 01',
  status: 'online',
  cpu: 30,
  memory: 40,
  disk: 20,
  network: 30,
  uptime: '24h',
  location: 'onprem-dc1',
};

describe('normalizeServerData networkStatus', () => {
  it('status가 offline이면 networkStatus도 offline', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      status: 'offline',
      network: 95,
    });

    expect(normalized.networkStatus).toBe('offline');
  });

  it('online + network가 critical 임계값 이상이면 poor', () => {
    const threshold = getThreshold('network');
    const normalized = normalizeServerData({
      ...baseServer,
      status: 'online',
      network: threshold.critical,
    });

    expect(normalized.networkStatus).toBe('poor');
  });

  it('online + network가 warning*0.6 미만이면 excellent', () => {
    const threshold = getThreshold('network');
    const normalized = normalizeServerData({
      ...baseServer,
      status: 'online',
      network: threshold.warning * 0.6 - 0.1,
    });

    expect(normalized.networkStatus).toBe('excellent');
  });

  it('warning 상태는 network 수치와 무관하게 good/poor 규칙을 따른다', () => {
    const threshold = getThreshold('network');
    const low = normalizeServerData({
      ...baseServer,
      status: 'warning',
      network: threshold.warning * 0.3,
    });
    const high = normalizeServerData({
      ...baseServer,
      status: 'warning',
      network: threshold.critical + 1,
    });

    expect(low.networkStatus).toBe('good');
    expect(high.networkStatus).toBe('poor');
  });
});
