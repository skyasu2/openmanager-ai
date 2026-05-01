import { describe, expect, it } from 'vitest';
import { getThreshold } from '@/config/rules';
import type { Server } from '@/types/server';
import {
  inferServerTypeFromId,
  normalizeServerData,
} from './EnhancedServerModal.utils';

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

  it('기본 health fallback에 status를 함께 채운다', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      health: undefined,
      status: 'warning',
    });

    expect(normalized.health).toEqual({
      score: 0,
      trend: [],
      status: 'warning',
    });
  });

  it('명시된 application 타입은 그대로 유지한다', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      id: 'api-was-dc1-01',
      name: 'api-was-dc1-01',
      type: 'application',
    });

    expect(normalized.type).toBe('application');
  });

  it('타입이 비어 있으면 api-was 서버를 application으로 추론한다', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      id: 'api-was-dc1-01',
      name: 'api-was-dc1-01',
      type: undefined,
    });

    expect(normalized.type).toBe('application');
  });

  it('타입이 unknown이면 api-was 서버를 application으로 재추론한다', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      id: 'api-was-dc1-01',
      name: 'api-was-dc1-01',
      type: 'unknown' as Server['type'],
    });

    expect(normalized.type).toBe('application');
  });

  it('타입이 비어 있으면 web-nginx 서버를 web으로 추론한다', () => {
    const normalized = normalizeServerData({
      ...baseServer,
      id: 'web-nginx-dc1-01',
      name: 'web-nginx-dc1-01',
      type: undefined,
    });

    expect(normalized.type).toBe('web');
  });

  it('서버 id/name 패턴별 타입 추론을 제공한다', () => {
    expect(inferServerTypeFromId('db-mysql-dc1-primary')).toBe('database');
    expect(inferServerTypeFromId('cache-redis-dc1-01')).toBe('cache');
    expect(inferServerTypeFromId('storage-nfs-dc1-01')).toBe('storage');
    expect(inferServerTypeFromId('lb-haproxy-dc1-01')).toBe('load-balancer');
  });
});
