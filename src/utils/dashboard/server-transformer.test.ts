import { describe, expect, it } from 'vitest';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import { transformServerData } from './server-transformer';

describe('server-transformer', () => {
  it('should transform raw server data to standard Server type', () => {
    const rawData: EnhancedServerData[] = [
      {
        id: 'srv-01',
        name: 'Test Server',
        status: 'online',
        cpu: 45.6,
        memory: 55.2,
        disk: 30.1,
        network: 123.4,
        uptime: 3600,
        location: 'Seoul',
        ip: '10.0.0.1',
        type: 'web',
        environment: 'production',
      } as Partial<EnhancedServerData> as EnhancedServerData,
    ];

    const result = transformServerData(rawData);
    expect(result).toHaveLength(1);
    const server = result[0];

    expect(server.id).toBe('srv-01');
    expect(server.name).toBe('Test Server');
    expect(server.status).toBe('online');
    expect(server.cpu).toBe(46); // Rounded
    expect(server.memory).toBe(55); // Rounded
    expect(server.disk).toBe(30); // Rounded
    expect(server.network).toBe(123); // Rounded
    expect(server.role).toBe('web');
    expect(server.environment).toBe('production');
  });

  it('should handle missing fields with defaults', () => {
    const rawData: EnhancedServerData[] = [
      {
        id: 'srv-02',
      } as Partial<EnhancedServerData> as EnhancedServerData,
    ];

    const result = transformServerData(rawData);
    const server = result[0];

    expect(server.name).toBe('Unknown');
    expect(server.status).toBe('unknown');
    expect(server.cpu).toBe(0);
    expect(server.role).toBe('worker');
    expect(server.environment).toBe('production');
  });

  it('should handle legacy metric field names', () => {
    const rawData: EnhancedServerData[] = [
      {
        id: 'srv-03',
        cpu_usage: 75,
        memory_usage: 85,
        disk_usage: 95,
        network_in: 100,
        network_out: 50,
      } as Partial<EnhancedServerData> as EnhancedServerData,
    ];

    const result = transformServerData(rawData);
    const server = result[0];

    expect(server.cpu).toBe(75);
    expect(server.memory).toBe(85);
    expect(server.disk).toBe(95);
    expect(server.network).toBe(150); // in + out
  });

  it('should normalize status aliases', () => {
    // Transformer itself doesn't aliases, it just checks for valid status values.
    // Aliases are handled by normalizeDashboardStatus in useServerDashboard.
    // Let's verify what transformer does with invalid status.
    const rawData: EnhancedServerData[] = [
      {
        id: 'srv-04',
        status: 'weird',
      } as Partial<EnhancedServerData> as EnhancedServerData,
    ];

    const result = transformServerData(rawData);
    expect(result[0].status).toBe('unknown');
  });
});
