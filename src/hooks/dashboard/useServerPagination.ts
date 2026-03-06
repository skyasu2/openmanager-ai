import { useEffect, useMemo, useRef, useState } from 'react';
import { calculatePagination } from '@/utils/dashboard/server-utils';

export function useServerPagination<T>(
  items: T[],
  initialPageSize: number = 15
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const previousInitialPageSizeRef = useRef(initialPageSize);

  useEffect(() => {
    if (previousInitialPageSizeRef.current !== initialPageSize) {
      previousInitialPageSizeRef.current = initialPageSize;
      setPageSize(initialPageSize);
      setCurrentPage(1);
    }
  }, [initialPageSize]);

  const { paginatedItems, totalPages } = useMemo(() => {
    return calculatePagination(items, currentPage, pageSize);
  }, [items, currentPage, pageSize]);

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  return {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    changePageSize,
    paginatedItems,
    totalPages,
  };
}
