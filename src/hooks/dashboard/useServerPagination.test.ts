// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useServerPagination } from './useServerPagination';

describe('useServerPagination', () => {
  it('paginates items and updates the current page', () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    const { result } = renderHook(() => useServerPagination(items, 10));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginatedItems).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedItems).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  it('resets to the first page when the page size changes', () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    const { result } = renderHook(() => useServerPagination(items, 10));

    act(() => {
      result.current.setCurrentPage(3);
    });
    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.changePageSize(15);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(15);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.paginatedItems).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('syncs to a new initial page size on rerender', () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    const { result, rerender } = renderHook(
      ({ initialPageSize }) => useServerPagination(items, initialPageSize),
      {
        initialProps: { initialPageSize: 10 },
      }
    );

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    rerender({ initialPageSize: 5 });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(5);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.paginatedItems).toEqual([1, 2, 3, 4, 5]);
  });
});
