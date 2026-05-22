import { useEffect, useMemo, useState } from 'react';

export interface InventoryPaginationResult<T> {
  page: number;
  pageSize: number;
  pageCount: number;
  pageItems: T[];
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const useInventoryPagination = <T,>(items: T[], initialPageSize = 20): InventoryPaginationResult<T> => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pageItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    pageSize,
    pageCount,
    pageItems,
    total,
    hasPrev: page > 1,
    hasNext: page < pageCount,
    setPage,
    setPageSize,
  };
};
