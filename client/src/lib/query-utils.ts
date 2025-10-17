/**
 * Query utilities for optimizing React Query usage
 * Provides common configurations and helpers for data fetching
 */

import { useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Default query options for different data types
 */
export const QUERY_DEFAULTS = {
  // Frequently changing data (projects, communications)
  dynamic: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    retry: 2,
  },
  // Rarely changing data (clients, system config)
  static: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  },
  // Real-time data (OneDrive sync status)
  realtime: {
    staleTime: 0, // Always refetch
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    retry: 1,
  },
  // Heavy data (file listings, large reports)
  heavy: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  },
} as const;

/**
 * Query key factories for consistent cache invalidation
 */
export const queryKeys = {
  // Projects
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.projects.lists(), { filters }] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
  },

  // Clients
  clients: {
    all: ['clients'] as const,
    lists: () => [...queryKeys.clients.all, 'list'] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.clients.lists(), { filters }] as const,
    details: () => [...queryKeys.clients.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clients.details(), id] as const,
  },

  // OneDrive
  onedrive: {
    all: ['onedrive'] as const,
    connection: () => [...queryKeys.onedrive.all, 'connection'] as const,
    mappings: () => [...queryKeys.onedrive.all, 'mappings'] as const,
    mapping: (projectCode: string) => [...queryKeys.onedrive.mappings(), projectCode] as const,
    files: () => [...queryKeys.onedrive.all, 'files'] as const,
    fileList: (path: string) => [...queryKeys.onedrive.files(), path] as const,
  },

  // Communications
  communications: {
    all: ['communications'] as const,
    lists: () => [...queryKeys.communications.all, 'list'] as const,
    list: (projectId?: string) => [...queryKeys.communications.lists(), { projectId }] as const,
  },

  // Deadlines
  deadlines: {
    all: ['deadlines'] as const,
    lists: () => [...queryKeys.deadlines.all, 'list'] as const,
    list: (projectId?: string) => [...queryKeys.deadlines.lists(), { projectId }] as const,
  },
} as const;

/**
 * Hook to invalidate related queries after mutations
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  const invalidateProjects = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }, [queryClient]);

  const invalidateProject = useCallback((id: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
  }, [queryClient]);

  const invalidateClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
  }, [queryClient]);

  const invalidateOneDrive = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.onedrive.all });
  }, [queryClient]);

  const invalidateCommunications = useCallback((projectId?: string) => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.communications.list(projectId) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.communications.all });
    }
  }, [queryClient]);

  const invalidateDeadlines = useCallback((projectId?: string) => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.deadlines.list(projectId) });
    } else {
      queryClient.invalidateQueries({ queryKey: queryKeys.deadlines.all });
    }
  }, [queryClient]);

  return {
    invalidateProjects,
    invalidateProject,
    invalidateClients,
    invalidateOneDrive,
    invalidateCommunications,
    invalidateDeadlines,
  };
}

/**
 * Optimistic update helper
 */
export function optimisticUpdate<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  updater: (old: T | undefined) => T
) {
  // Cancel outgoing refetches
  queryClient.cancelQueries({ queryKey });

  // Snapshot previous value
  const previous = queryClient.getQueryData<T>(queryKey);

  // Optimistically update
  queryClient.setQueryData<T>(queryKey, updater);

  // Return rollback function
  return () => {
    queryClient.setQueryData(queryKey, previous);
  };
}

/**
 * Prefetch helper for navigation optimization
 */
export function usePrefetchQueries() {
  const queryClient = useQueryClient();

  const prefetchProject = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.detail(id),
      queryFn: () => fetch(`/api/projects/${id}`).then(res => res.json()),
      ...QUERY_DEFAULTS.dynamic,
    });
  }, [queryClient]);

  const prefetchProjects = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.lists(),
      queryFn: () => fetch('/api/projects').then(res => res.json()),
      ...QUERY_DEFAULTS.dynamic,
    });
  }, [queryClient]);

  return {
    prefetchProject,
    prefetchProjects,
  };
}

/**
 * Debounced query helper for search/filter operations
 */
export function useDebouncedQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  debounceMs: number = 300,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  // This would require additional debounce implementation
  // For now, just return the query configuration
  return {
    queryKey,
    queryFn,
    ...options,
    // Add debounce logic here if needed
  };
}
