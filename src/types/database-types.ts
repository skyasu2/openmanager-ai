// src/types/database.ts
/**
 * OpenManager AI - Database Type Definitions
 * Supabase compatible database schema types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Servers table
      servers: {
        Row: {
          id: string;
          name: string;
          type: ServerType;
          status: ServerStatus;
          location: string;
          ip_address: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: ServerType;
          status?: ServerStatus;
          location: string;
          ip_address: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          type?: ServerType;
          status?: ServerStatus;
          location?: string;
          ip_address?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };

      // Monitoring logs table
      monitoring_logs: {
        Row: {
          id: string;
          server_id: string;
          metric_type: MetricType;
          value: number;
          unit: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          server_id: string;
          metric_type: MetricType;
          value: number;
          unit: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          server_id?: string;
          metric_type?: MetricType;
          value?: number;
          unit?: string;
          metadata?: Json;
          created_at?: string;
        };
      };

      // Reports table
      reports: {
        Row: {
          id: string;
          title: string;
          type: ReportType;
          content: string;
          server_ids: string[];
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type: ReportType;
          content: string;
          server_ids?: string[];
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: ReportType;
          content?: string;
          server_ids?: string[];
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // Query results cache table
      query_results: {
        Row: {
          id: string;
          query: string;
          query_hash: string;
          result: Json;
          confidence: number;
          metadata: Json;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          query: string;
          query_hash: string;
          result: Json;
          confidence: number;
          metadata?: Json;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          query?: string;
          query_hash?: string;
          result?: Json;
          confidence?: number;
          metadata?: Json;
          created_at?: string;
          expires_at?: string | null;
        };
      };

      // Alerts table
      alerts: {
        Row: {
          id: string;
          server_id: string;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          description: string;
          status: AlertStatus;
          metadata: Json;
          triggered_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          server_id: string;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          description: string;
          status?: AlertStatus;
          metadata?: Json;
          triggered_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          server_id?: string;
          type?: AlertType;
          severity?: AlertSeverity;
          title?: string;
          description?: string;
          status?: AlertStatus;
          metadata?: Json;
          triggered_at?: string;
          resolved_at?: string | null;
        };
      };

      // Performance logs table (for monitoring our own system)
      performance_logs: {
        Row: {
          id: string;
          function_name: string;
          duration_ms: number;
          success: boolean;
          error_message: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          function_name: string;
          duration_ms: number;
          success: boolean;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          function_name?: string;
          duration_ms?: number;
          success?: boolean;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };

      // Storage operations table (for tracking Supabase usage)
      storage_operations: {
        Row: {
          id: string;
          operation: string;
          table_name: string;
          size_bytes: number;
          timestamp: string;
        };
        Insert: {
          id?: string;
          operation: string;
          table_name: string;
          size_bytes: number;
          timestamp?: string;
        };
        Update: {
          id?: string;
          operation?: string;
          table_name?: string;
          size_bytes?: number;
          timestamp?: string;
        };
      };

      // Archived monitoring logs table (for old _data)
      archived_monitoring_logs: {
        Row: {
          id: string;
          data: string; // Compressed JSON
          archived_at: string;
          record_count: number;
        };
        Insert: {
          id?: string;
          data: string;
          archived_at?: string;
          record_count: number;
        };
        Update: {
          id?: string;
          data?: string;
          archived_at?: string;
          record_count?: number;
        };
      };

      // Cached data table (hybrid storage)
      cached_data: {
        Row: {
          key: string;
          value: Json;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      // Server status summary view
      server_status_summary: {
        Row: {
          server_id: string;
          server_name: string;
          server_type: ServerType;
          status: ServerStatus;
          location: string;
          cpu_usage: number | null;
          memory_usage: number | null;
          disk_usage: number | null;
          active_alerts: number;
          last_updated: string;
        };
      };

      // Alert statistics view
      alert_statistics: {
        Row: {
          server_id: string;
          server_name: string;
          total_alerts: number;
          critical_alerts: number;
          warning_alerts: number;
          info_alerts: number;
          active_alerts: number;
          avg_resolution_time_hours: number | null;
        };
      };

      // System health overview
      system_health_overview: {
        Row: {
          total_servers: number;
          healthy_servers: number;
          warning_servers: number;
          critical_servers: number;
          total_active_alerts: number;
          avg_cpu_usage: number | null;
          avg_memory_usage: number | null;
          avg_disk_usage: number | null;
        };
      };
    };
    Functions: {
      // Get table size function
      get_table_size: {
        Args: {
          table_name: string;
        };
        Returns: {
          size: number;
        };
      };

      // Get server metrics
      get_server_metrics: {
        Args: {
          server_id: string;
          metric_type: MetricType;
          hours_ago: number;
        };
        Returns: Array<{
          timestamp: string;
          value: number;
        }>;
      };

      // Get alert trends
      get_alert_trends: {
        Args: {
          days: number;
        };
        Returns: Array<{
          date: string;
          total_alerts: number;
          by_severity: Json;
        }>;
      };
    };
    Enums: {
      server_type: ServerType;
      server_status: ServerStatus;
      metric_type: MetricType;
      report_type: ReportType;
      alert_type: AlertType;
      alert_severity: AlertSeverity;
      alert_status: AlertStatus;
    };
  };
}

// Enum types
export type ServerType =
  | 'web'
  | 'database'
  | 'cache'
  | 'application'
  | 'load_balancer'
  | 'monitoring';

// 🎯 ServerStatus 타입 통합 (2025-09-30)
// Single Source of Truth: src/types/server-enums.ts
import type { ServerStatus } from './server-enums';
export type { ServerStatus };

export type MetricType =
  | 'cpu_usage'
  | 'memory_usage'
  | 'disk_usage'
  | 'network_in'
  | 'network_out'
  | 'request_count'
  | 'error_rate'
  | 'response_time'
  | 'uptime'
  | 'custom';

export type ReportType =
  | 'performance'
  | 'incident'
  | 'capacity'
  | 'security'
  | 'compliance'
  | 'executive_summary'
  | 'custom';

export type AlertType =
  | 'performance'
  | 'availability'
  | 'security'
  | 'capacity'
  | 'configuration'
  | 'custom';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

// Helper types for easier access
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T];
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
export type Functions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T];

// Specific table types for convenience
export type Server = TableRow<'servers'>;
export type MonitoringLog = TableRow<'monitoring_logs'>;
export type Report = TableRow<'reports'>;
export type QueryResult = TableRow<'query_results'>;
export type Alert = TableRow<'alerts'>;
export type PerformanceLog = TableRow<'performance_logs'>;

// View types
export type ServerStatusSummary = Views<'server_status_summary'>;
export type AlertStatistics = Views<'alert_statistics'>;
export type SystemHealthOverview = Views<'system_health_overview'>;

// Utility types for partial updates
export type PartialServer = Partial<Server>;
export type PartialReport = Partial<Report>;
export type PartialAlert = Partial<Alert>;

// Query builder types (for type-safe query construction)
export interface QueryOptions {
  select?: string;
  order?: Array<{
    column: string;
    ascending?: boolean;
  }>;
  limit?: number;
  offset?: number;
  filters?: Record<
    string,
    string | number | boolean | null | string[] | number[]
  >;
}

// Response types for database operations
export interface DbResponse<T> {
  data: T | null;
  error: Error | null;
  count?: number;
}

export interface DbListResponse<T> {
  data: T[] | null;
  error: Error | null;
  count?: number;
  hasMore?: boolean;
}

// Type guards
export function isServer(obj: unknown): obj is Server {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'name' in obj &&
    typeof (obj as Server).id === 'string' &&
    typeof (obj as Server).name === 'string'
  );
}

export function isAlert(obj: unknown): obj is Alert {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'server_id' in obj &&
    typeof (obj as Alert).id === 'string' &&
    typeof (obj as Alert).server_id === 'string'
  );
}

export function isReport(obj: unknown): obj is Report {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'title' in obj &&
    typeof (obj as Report).id === 'string' &&
    typeof (obj as Report).title === 'string'
  );
}
