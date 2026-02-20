import type { Alert, Report, Server } from './database-types';

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
