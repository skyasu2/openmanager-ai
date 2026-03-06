/**
 * Compatibility wrapper for legacy imports.
 *
 * The canonical server metric/status schemas live in `api.server.schema.ts`.
 */

export {
  type NetworkMetrics,
  NetworkMetricsSchema,
  type ServerMetrics,
  ServerMetricsSchema,
  type ServerStatus,
  ServerStatusSchema,
} from '../api.server.schema';
