import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculatePagination } from '@/utils/dashboard/server-utils';

const normalizePageSize = (pageSize: number) => {
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(pageSize));
};

export function useServerPagination<T>(
  items: T[],
  initialPageSize: number = 15
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(() =>
    normalizePageSize(initialPageSize)
  );
  const previousInitialPageSizeRef = useRef(initialPageSize);
  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(normalizePageSize(newSize));
  }, []);

  useEffect(() => {
    if (previousInitialPageSizeRef.current !== initialPageSize) {
      previousInitialPageSizeRef.current = initialPageSize;
      setPageSize(initialPageSize);
      setCurrentPage(1);
    }
  }, [initialPageSize, setPageSize]);

  const totalPages = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }

    return Math.ceil(items.length / pageSize);
  }, [items, pageSize]);

  const effectiveCurrentPage =
    totalPages > 0 ? Math.max(1, Math.min(currentPage, totalPages)) : 1;

  const { paginatedItems } = useMemo(() => {
    return calculatePagination(items, effectiveCurrentPage, pageSize);
  }, [items, effectiveCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage !== effectiveCurrentPage) {
      setCurrentPage(effectiveCurrentPage);
    }
  }, [currentPage, effectiveCurrentPage]);

  const changePageSize = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  return {
    currentPage: effectiveCurrentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    changePageSize,
    paginatedItems,
    totalPages,
  };
}
