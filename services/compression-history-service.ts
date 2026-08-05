'use server';

import { fetchCompressionHistoryForUser, type DashboardHistoryItem } from '@/services/compression-history';

export type { DashboardHistoryItem };

/**
 * Server Action used by the Dashboard client component to load history from Supabase.
 */
export async function getCompressionHistoryForDashboard(): Promise<DashboardHistoryItem[]> {
  return fetchCompressionHistoryForUser();
}
