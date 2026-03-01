/**
 * Shared pagination types used by both server and client.
 */

export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Maximum allowed page size to prevent abuse */
export const MAX_PAGE_SIZE = 100;

/** Default page size when not specified */
export const DEFAULT_PAGE_SIZE = 25;

/**
 * Parse pagination query params from a request query object.
 * Returns undefined if no pagination params are present (backward-compatible).
 */
export function parsePaginationParams(query: Record<string, any>): PaginationParams | undefined {
  const page = query.page ? parseInt(query.page as string, 10) : undefined;
  const pageSize = query.pageSize ? parseInt(query.pageSize as string, 10) : undefined;

  // If neither page nor pageSize is specified, no pagination requested
  if (page === undefined && pageSize === undefined) {
    return undefined;
  }

  return {
    page: Math.max(1, page || 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize || DEFAULT_PAGE_SIZE)),
    search: (query.search as string) || undefined,
    sortField: (query.sortField as string) || undefined,
    sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc',
  };
}

/**
 * Build a PaginatedResponse from data array and total count.
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}
