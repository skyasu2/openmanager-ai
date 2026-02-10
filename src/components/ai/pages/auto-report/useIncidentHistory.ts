'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IncidentReport } from './types';

export interface HistoryFilters {
  severity: string;
  status: string;
  dateRange: 'all' | '7d' | '30d' | '90d';
  search: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface DBIncidentReport {
  id: string;
  title: string;
  severity: string;
  pattern: string | null;
  affected_servers: string[];
  anomalies: Array<{
    server_id: string;
    server_name: string;
    metric: string;
    value: number;
    severity: string;
  }>;
  root_cause_analysis: {
    primary_cause?: string;
  };
  recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  timeline: Array<{
    timestamp: string;
    event: string;
    severity: string;
  }>;
  status: string;
  created_at: string;
  resolved_at: string | null;
  system_summary?: {
    total_servers: number;
    healthy_servers: number;
    warning_servers: number;
    critical_servers: number;
  };
}

function mapDBToIncidentReport(db: DBIncidentReport): IncidentReport {
  return {
    id: db.id,
    title: db.title,
    severity: db.severity as IncidentReport['severity'],
    timestamp: new Date(db.created_at),
    affectedServers: db.affected_servers || [],
    description: db.root_cause_analysis?.primary_cause || '',
    status: db.status as IncidentReport['status'],
    pattern: db.pattern || undefined,
    recommendations: db.recommendations,
    systemSummary: db.system_summary
      ? {
          totalServers: db.system_summary.total_servers,
          healthyServers: db.system_summary.healthy_servers,
          warningServers: db.system_summary.warning_servers,
          criticalServers: db.system_summary.critical_servers,
        }
      : undefined,
    anomalies: db.anomalies,
    timeline: db.timeline,
  };
}

export function useIncidentHistory() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(
    null
  );

  const [filters, setFilters] = useState<HistoryFilters>({
    severity: 'all',
    status: 'all',
    dateRange: '30d',
    search: '',
  });

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchReports = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
        });

        if (filters.severity !== 'all') {
          params.append('severity', filters.severity);
        }
        if (filters.status !== 'all') {
          params.append('status', filters.status);
        }
        if (filters.dateRange !== 'all') {
          params.append('dateRange', filters.dateRange);
        }
        if (filters.search) {
          params.append('search', filters.search);
        }

        const response = await fetch(`/api/ai/incident-report?${params}`, {
          signal,
        });
        if (!response.ok) {
          throw new Error(`보고서 조회 실패 (HTTP ${response.status})`);
        }

        const data = await response.json();

        if (data.success) {
          const mappedReports = (data.reports || []).map(mapDBToIncidentReport);
          setReports(mappedReports);
          setPagination((prev) => ({
            ...prev,
            total: data.total || mappedReports.length,
            totalPages:
              data.totalPages ||
              Math.ceil((data.total || mappedReports.length) / prev.limit),
          }));
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [pagination.page, pagination.limit, filters]
  );

  useEffect(() => {
    const abortController = new AbortController();
    fetchReports(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [fetchReports]);

  const handleRefresh = useCallback(() => {
    fetchReports();
  }, [fetchReports]);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const handleFilterChange = useCallback(
    (key: keyof HistoryFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    []
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchInput(value);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      searchDebounceRef.current = setTimeout(() => {
        handleFilterChange('search', value);
        searchDebounceRef.current = null;
      }, 300);
    },
    [handleFilterChange]
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const handleSeverityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleFilterChange('severity', e.target.value);
    },
    [handleFilterChange]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleFilterChange('status', e.target.value);
    },
    [handleFilterChange]
  );

  const handleDateRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleFilterChange('dateRange', e.target.value);
    },
    [handleFilterChange]
  );

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  const handlePrevPage = useCallback(() => {
    handlePageChange(pagination.page - 1);
  }, [handlePageChange, pagination.page]);

  const handleNextPage = useCallback(() => {
    handlePageChange(pagination.page + 1);
  }, [handlePageChange, pagination.page]);

  const handleReportSelect = useCallback((report: IncidentReport) => {
    setSelectedReport(report);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedReport(null);
  }, []);

  const clearFilters = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchInput('');
    setFilters({
      severity: 'all',
      status: 'all',
      dateRange: '30d',
      search: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const formatDate = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }, []);

  return {
    reports,
    loading,
    error,
    selectedReport,
    filters,
    pagination,
    showFilters,
    searchInput,
    handleRefresh,
    handleSearchChange,
    handleSeverityChange,
    handleStatusChange,
    handleDateRangeChange,
    toggleFilters,
    handlePrevPage,
    handleNextPage,
    handleReportSelect,
    handleCloseDetail,
    clearFilters,
    formatDate,
  };
}
