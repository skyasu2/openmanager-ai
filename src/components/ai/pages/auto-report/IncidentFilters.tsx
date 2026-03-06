'use client';

import { Search, X } from 'lucide-react';
import { memo } from 'react';
import { INCIDENT_REPORT_SEVERITIES, INCIDENT_REPORT_STATUSES } from './types';
import type { HistoryFilters } from './useIncidentHistory';

const SEVERITY_LABELS: Record<
  (typeof INCIDENT_REPORT_SEVERITIES)[number],
  string
> = {
  critical: '심각',
  warning: '경고',
  info: '정보',
  high: '높음',
  medium: '중간',
  low: '낮음',
};

const STATUS_LABELS: Record<(typeof INCIDENT_REPORT_STATUSES)[number], string> =
  {
    active: '활성',
    investigating: '조사중',
    resolved: '해결됨',
  };

interface IncidentFiltersProps {
  searchInput: string;
  filters: HistoryFilters;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSeverityChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onDateRangeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onClearFilters: () => void;
}

export const IncidentFilters = memo(function IncidentFilters({
  searchInput,
  filters,
  onSearchChange,
  onSeverityChange,
  onStatusChange,
  onDateRangeChange,
  onClearFilters,
}: IncidentFiltersProps) {
  return (
    <div className="border-b border-gray-200 bg-white/50 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="보고서 검색..."
            value={searchInput}
            onChange={onSearchChange}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <select
          value={filters.severity}
          onChange={onSeverityChange}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">모든 심각도</option>
          {INCIDENT_REPORT_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {SEVERITY_LABELS[severity]}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={onStatusChange}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">모든 상태</option>
          {INCIDENT_REPORT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <select
          value={filters.dateRange}
          onChange={onDateRangeChange}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">전체 기간</option>
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="90d">최근 90일</option>
        </select>

        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
          초기화
        </button>
      </div>
    </div>
  );
});
