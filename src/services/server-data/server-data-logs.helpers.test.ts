import { describe, expect, it } from 'vitest';

import {
  APP_LAYER_SOURCES,
  inferServerType,
  matchRole,
  SERVER_TYPE_SOURCES,
} from './server-data-logs.helpers';

describe('APP_LAYER_SOURCES', () => {
  it('contains expected application-layer sources', () => {
    for (const src of [
      'java',
      'nginx',
      'haproxy',
      'redis',
      'mysql',
      'postgres',
      'docker',
      'node',
    ]) {
      expect(APP_LAYER_SOURCES.has(src)).toBe(true);
    }
  });

  it('does not contain system-level sources', () => {
    for (const src of ['kernel', 'systemd', 'cron', 'sshd']) {
      expect(APP_LAYER_SOURCES.has(src)).toBe(false);
    }
  });
});

describe('SERVER_TYPE_SOURCES', () => {
  it('web type includes nginx', () => {
    expect(SERVER_TYPE_SOURCES.web.has('nginx')).toBe(true);
  });

  it('database type includes mysql and postgres', () => {
    expect(SERVER_TYPE_SOURCES.database.has('mysql')).toBe(true);
    expect(SERVER_TYPE_SOURCES.database.has('postgres')).toBe(true);
  });

  it('cache type includes redis', () => {
    expect(SERVER_TYPE_SOURCES.cache.has('redis')).toBe(true);
  });
});

describe('matchRole', () => {
  it('returns true when a keyword matches the serverId', () => {
    expect(matchRole('prod-api-server-01', ['api', 'web'])).toBe(true);
  });

  it('returns false when no keyword matches', () => {
    expect(matchRole('prod-api-server-01', ['db', 'cache'])).toBe(false);
  });

  it('matches partial substrings within the serverId', () => {
    expect(matchRole('mysql-primary-db', ['sql'])).toBe(true);
  });
});

describe('inferServerType', () => {
  it('returns explicit type when it is a valid ServerType (case insensitive)', () => {
    expect(inferServerType('Database', 'some-server')).toBe('database');
    expect(inferServerType('CACHE', 'some-server')).toBe('cache');
    expect(inferServerType('Web', 'any-id')).toBe('web');
  });

  it('infers database from serverId containing "db"', () => {
    expect(inferServerType('unknown', 'prod-db-01')).toBe('database');
  });

  it('infers cache from serverId containing "redis"', () => {
    expect(inferServerType('unknown', 'redis-cluster-03')).toBe('cache');
  });

  it('infers loadbalancer from serverId containing "lb"', () => {
    expect(inferServerType('unknown', 'internal-lb-02')).toBe('loadbalancer');
  });

  it('infers storage from serverId containing "nfs"', () => {
    expect(inferServerType('unknown', 'nfs-backup-01')).toBe('storage');
  });

  it('infers application from serverId containing "api"', () => {
    expect(inferServerType('unknown', 'api-gateway-01')).toBe('application');
  });

  it('defaults to web when type and serverId are unrecognized', () => {
    expect(inferServerType('something', 'random-host-99')).toBe('web');
  });
});
