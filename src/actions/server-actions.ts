'use server';

import { getServerMonitoringService } from '@/services/monitoring';
import type { EnhancedServerMetrics } from '@/types/server';
import { logger } from '@/lib/logging';

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
    const service = getServerMonitoringService();
    // Assuming getAllAsEnhancedMetrics returns EnhancedServerMetrics[]
    const servers = service.getAllAsEnhancedMetrics();

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
