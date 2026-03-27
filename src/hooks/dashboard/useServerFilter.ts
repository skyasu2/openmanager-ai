import { useMemo, useState } from 'react';
import type { Server } from '@/types/server';

export function useServerFilter(servers: Server[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  // 🌍 고유 위치 목록
  const uniqueLocations = useMemo(() => {
    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return [];
    }
    return Array.from(new Set(servers.map((server) => server.location))).sort();
  }, [servers]);

  // 🔍 필터링된 서버
  const filteredServers = useMemo(() => {
    if (!servers || !Array.isArray(servers) || servers.length === 0) {
      return [];
    }

    return servers.filter((server) => {
      const matchesSearch =
        server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || server.status === statusFilter;
      const matchesLocation =
        locationFilter === 'all' || server.location === locationFilter;

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [servers, searchTerm, statusFilter, locationFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setLocationFilter('all');
  };

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    locationFilter,
    setLocationFilter,
    filteredServers,
    uniqueLocations,
    resetFilters,
  };
}
