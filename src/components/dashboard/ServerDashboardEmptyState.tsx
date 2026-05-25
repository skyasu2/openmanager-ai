import { FileText } from 'lucide-react';

interface ServerDashboardEmptyStateProps {
  isSearching: boolean;
}

export function ServerDashboardEmptyState({
  isSearching,
}: ServerDashboardEmptyStateProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-6 w-6 text-gray-400" aria-hidden="true" />
        </div>
        <h3 className="mb-1 text-sm font-medium text-gray-900">
          {isSearching ? '검색 결과 없음' : '서버 정보 없음'}
        </h3>
        <p className="text-sm text-gray-500">
          {isSearching
            ? '검색어를 지우거나 다른 서버 이름, ID, IP, 위치를 입력하세요.'
            : '표시할 서버가 없습니다.'}
        </p>
      </div>
    </div>
  );
}
