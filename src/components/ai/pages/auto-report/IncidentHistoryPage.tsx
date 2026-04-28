/**
 * 장애 보고서 히스토리 페이지
 *
 * Supabase에 저장된 과거 장애 보고서 조회
 */

'use client';

import { AlertCircle, FileText, Filter, RefreshCw } from 'lucide-react';
import { memo } from 'react';
import { IncidentFilters } from './IncidentFilters';
import { IncidentTable } from './IncidentTable';
import { useIncidentHistory } from './useIncidentHistory';

export const IncidentHistoryPage = memo(function IncidentHistoryPage() {
  const {
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
  } = useIncidentHistory();
  const rangeStart =
    pagination.total === 0
      ? 0
      : pagination.page * pagination.limit - pagination.limit + 1;
  const rangeEnd =
    pagination.total === 0
      ? 0
      : Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex h-full flex-col bg-linear-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-r from-blue-500 to-indigo-500">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                보고서 히스토리
              </h2>
              <p className="text-sm text-gray-600">과거 장애 보고서 조회</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFilters}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                showFilters
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              필터
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <IncidentFilters
          searchInput={searchInput}
          filters={filters}
          onSearchChange={handleSearchChange}
          onSeverityChange={handleSeverityChange}
          onStatusChange={handleStatusChange}
          onDateRangeChange={handleDateRangeChange}
          onClearFilters={clearFilters}
        />
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <IncidentTable
        reports={reports}
        loading={loading}
        selectedReport={selectedReport}
        pagination={pagination}
        formatDate={formatDate}
        onReportSelect={handleReportSelect}
        onCloseDetail={handleCloseDetail}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
      />

      {/* Footer Stats */}
      <div className="border-t border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>총 {pagination.total}개 보고서</span>
          <span>
            {rangeStart} - {rangeEnd} 표시 중
          </span>
        </div>
      </div>
    </div>
  );
});
