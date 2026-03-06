// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Server } from '@/types/server';
import { useServerFilter } from './useServerFilter';

const servers: Server[] = [
  {
    id: 'srv-1',
    name: 'Alpha Web',
    status: 'online',
    cpu: 21,
    memory: 48,
    disk: 35,
    uptime: '12h',
    location: 'Seoul',
  },
  {
    id: 'srv-2',
    name: 'Beta DB',
    status: 'warning',
    cpu: 77,
    memory: 85,
    disk: 61,
    uptime: '8h',
    location: 'Tokyo',
  },
  {
    id: 'srv-3',
    name: 'Gamma Cache',
    status: 'offline',
    cpu: 0,
    memory: 0,
    disk: 0,
    uptime: '0h',
    location: 'Seoul',
  },
];

describe('useServerFilter', () => {
  it('returns all servers initially and unique locations sorted', () => {
    const { result } = renderHook(() => useServerFilter(servers));

    expect(result.current.filteredServers).toHaveLength(3);
    expect(result.current.uniqueLocations).toEqual(['Seoul', 'Tokyo']);
  });

  it('filters by search term, status, and resets all filters', () => {
    const { result } = renderHook(() => useServerFilter(servers));

    act(() => {
      result.current.setSearchTerm('beta');
    });
    expect(result.current.filteredServers.map((server) => server.id)).toEqual([
      'srv-2',
    ]);

    act(() => {
      result.current.setSearchTerm('');
      result.current.setStatusFilter('offline');
    });
    expect(result.current.filteredServers.map((server) => server.id)).toEqual([
      'srv-3',
    ]);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.statusFilter).toBe('all');
    expect(result.current.locationFilter).toBe('all');
    expect(result.current.filteredServers).toHaveLength(3);
  });
});
