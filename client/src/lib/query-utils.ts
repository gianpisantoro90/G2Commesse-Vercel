/**
 * Query utilities for optimizing React Query usage
 * Provides centralized query keys and invalidation helpers.
 *
 * IMPORTANT: Query keys must be URL-based arrays compatible with getQueryFn(),
 * which joins the array with "/" to form the fetch URL.
 * Non-URL keys (e.g. "onedrive-connection") require an explicit queryFn.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Centralized query key constants.
 * URL-based keys work with getQueryFn (auto-fetch via queryKey.join("/")).
 * Semantic keys (non-URL) require an explicit queryFn in the component.
 */
export const QK = {
  // Projects
  projects: ["/api/projects"] as const,
  projectDetail: (id: number | string) => [`/api/projects/${id}`] as const,
  projectPrestazioni: (id: number | string) => [`/api/projects/${id}/prestazioni`] as const,
  projectInvoices: (id: number | string) => [`/api/projects/${id}/invoices`] as const,
  projectCrePreview: (id: number | string) => [`/api/projects/${id}/cre/preview`] as const,

  // Clients
  clients: ["/api/clients"] as const,

  // Users
  users: ["/api/users"] as const,

  // Tasks
  tasks: ["/api/tasks"] as const,

  // Communications
  communications: ["/api/communications"] as const,
  communicationsPending: ["/api/communications/pending-review"] as const,

  // Deadlines
  deadlines: ["/api/deadlines"] as const,

  // Prestazioni
  prestazioni: ["/api/prestazioni"] as const,
  prestazioniStats: ["/api/prestazioni/stats"] as const,

  // Invoices
  invoices: ["/api/invoices"] as const,
  projectInvoicesList: ["/api/project-invoices"] as const,

  // Billing
  billingConfig: ["/api/billing-config"] as const,
  billingAlerts: ["/api/billing-alerts"] as const,
  billingAlertsStats: ["/api/billing-alerts/stats"] as const,
  billingAlertsByProject: (id: number | string) => [`/api/billing-alerts/${id}`] as const,

  // Resources & Costs
  projectResources: ["/api/project-resources"] as const,
  projectCosts: ["/api/project-costs"] as const,

  // Dashboard
  dashboardStats: ["/api/dashboard/stats"] as const,

  // AI
  aiSuggestedTasks: ["/api/ai/suggested-tasks"] as const,
  aiSuggestedDeadlines: ["/api/ai/suggested-deadlines"] as const,
  aiProjectHealth: ["/api/ai/project-health"] as const,
  aiProjectHealthDetail: (id: string) => [`/api/ai/project-health/${id}`] as const,
  aiInsights: ["/api/ai/insights"] as const,
  aiFeedbackStats: ["/api/ai/feedback-stats"] as const,
  aiCashFlowForecast: ["/api/ai/cashflow-forecast"] as const,

  // System
  systemConfig: ["/api/system-config"] as const,

  // OneDrive (URL-based)
  onedriveMappings: ["/api/onedrive/mappings"] as const,

  // OneDrive (semantic keys - require explicit queryFn)
  onedriveConnection: ["onedrive-connection"] as const,
  onedriveFiles: ["onedrive-files"] as const,
  onedriveBrowse: (path?: string) => path ? ["onedrive-browse", path] as const : ["onedrive-browse"] as const,
  onedriveSearch: (query?: string) => query ? ["onedrive-search", query] as const : ["onedrive-search"] as const,
  onedriveHierarchy: ["onedrive-hierarchy"] as const,
  onedriveAllFiles: ["onedrive-all-files"] as const,
  onedriveUser: ["onedrive-user"] as const,
  filesIndexStats: ["files-index-stats"] as const,
} as const;

/**
 * Hook to invalidate related queries after mutations.
 * Groups common invalidation patterns to avoid scattered queryClient calls.
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    projects: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.projects });
    }, [queryClient]),

    clients: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.clients });
    }, [queryClient]),

    communications: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.communications });
      queryClient.invalidateQueries({ queryKey: QK.communicationsPending });
    }, [queryClient]),

    deadlines: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.deadlines });
    }, [queryClient]),

    prestazioni: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.prestazioni });
      queryClient.invalidateQueries({ queryKey: QK.prestazioniStats });
    }, [queryClient]),

    invoices: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.invoices });
      queryClient.invalidateQueries({ queryKey: QK.projectInvoicesList });
    }, [queryClient]),

    billing: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.billingAlerts });
      queryClient.invalidateQueries({ queryKey: QK.billingAlertsStats });
      queryClient.invalidateQueries({ queryKey: QK.billingConfig });
    }, [queryClient]),

    onedrive: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.onedriveMappings });
      queryClient.invalidateQueries({ queryKey: ["onedrive-files"] });
      queryClient.invalidateQueries({ queryKey: ["onedrive-browse"] });
      queryClient.invalidateQueries({ queryKey: ["onedrive-hierarchy"] });
    }, [queryClient]),

    tasks: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.tasks });
    }, [queryClient]),

    users: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: QK.users });
    }, [queryClient]),
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
  queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<T>(queryKey);
  queryClient.setQueryData<T>(queryKey, updater);
  return () => {
    queryClient.setQueryData(queryKey, previous);
  };
}
