'use server';

import { logger } from '@/lib/logging';
import { getServerMonitoringService } from '@/services/monitoring';
import type { EnhancedServerMetrics } from '@/types/server';

/**
 * Server Action for fetching server list
 * Replaces GET /api/servers-unified?action=list
 */
export async function getServersAction(): Promise<{
  success: boolean;
  data: EnhancedServerMetrics[];
  error?: string;
}> {
  try {
    const { MetricsProvider } = await import(
      '@/services/metrics/MetricsProvider'
    );
    await MetricsProvider.getInstance().ensureDataLoaded();

    const service = getServerMonitoringService();
    const servers = await service.getAllAsEnhancedMetrics();

    return {
      success: true,
      data: servers,
    };
  } catch (error) {
    logger.error('Failed to fetch servers via Server Action', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
