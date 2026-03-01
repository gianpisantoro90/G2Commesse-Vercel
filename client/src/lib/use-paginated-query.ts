/**
 * Hook for server-side paginated queries.
 * Builds URL with pagination query params and returns typed paginated data.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface UsePaginatedQueryOptions {
  /** Base API path, e.g. "/api/projects" */
  basePath: string;
  /** Default page size (default: 25) */
  defaultPageSize?: 10 | 25 | 50;
  /** Additional filter params to include in the query */
  filters?: Record<string, string | undefined>;
  /** Search text */
  search?: string;
  /** Sort field */
  sortField?: string;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Build a URL with query params, filtering out undefined values.
 */
function buildUrl(basePath: string, params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function usePaginatedQuery<T>(options: UsePaginatedQueryOptions) {
  const {
    basePath,
    defaultPageSize = 25,
    filters = {},
    search,
    sortField,
    sortOrder = 'asc',
    enabled = true,
  } = options;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(defaultPageSize);

  // Build the full query params
  const queryParams = useMemo(() => ({
    page,
    pageSize,
    search,
    sortField,
    sortOrder,
    ...filters,
  }), [page, pageSize, search, sortField, sortOrder, filters]);

  // Build URL for fetching
  const url = useMemo(() => buildUrl(basePath, queryParams), [basePath, queryParams]);

  // Query key includes all params for proper caching
  const queryKey = useMemo(
    () => [basePath, 'paginated', queryParams] as const,
    [basePath, queryParams]
  );

  const query = useQuery<PaginatedResponse<T>>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  const pagination = query.data?.pagination;
  const data = query.data?.data ?? [];
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 0;

  // Reset to page 1 when filters/search/pageSize change
  const resetPage = useCallback(() => setPage(1), []);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages || 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setPage(prev => Math.min(prev + 1, totalPages || 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const changePageSize = useCallback((size: 10 | 25 | 50) => {
    setPageSize(size);
    setPage(1);
  }, []);

  return {
    // Data
    data,
    total,
    // Pagination state
    page,
    pageSize,
    totalPages,
    // Navigation
    setPage: goToPage,
    nextPage,
    prevPage,
    changePageSize,
    resetPage,
    // Query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
