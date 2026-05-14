import { describe, expect, it } from 'vitest';
import {
  getRegisteredServerAliases,
  getServerIP,
  resolveRegisteredServerId,
} from './server-registry';

describe('server registry aliases', () => {
  it('resolves canonical server IDs unchanged', () => {
    expect(resolveRegisteredServerId('api-was-dc1-01')).toBe('api-was-dc1-01');
  });

  it('resolves operator-friendly server aliases to canonical IDs', () => {
    expect(resolveRegisteredServerId('web-server-01')).toBe(
      'web-nginx-dc1-01'
    );
    expect(resolveRegisteredServerId('API-SERVER-03')).toBe('api-was-dc1-03');
    expect(resolveRegisteredServerId('  db-server-01  ')).toBe(
      'db-mysql-dc1-primary'
    );
  });

  it('exposes aliases without mixing them into canonical inventory', () => {
    expect(getRegisteredServerAliases()).toContain('cache-server-01');
    expect(getRegisteredServerAliases()).not.toContain('cache-redis-dc1-01');
  });

  it('looks up IP addresses through canonical IDs and aliases', () => {
    expect(getServerIP('web-nginx-dc1-01')).toBe('10.100.1.11');
    expect(getServerIP('web-server-01')).toBe('10.100.1.11');
  });

  it('does not fabricate unknown server IDs', () => {
    expect(resolveRegisteredServerId('unknown-server-01')).toBeUndefined();
    expect(getServerIP('unknown-server-01')).toBeUndefined();
  });
});
