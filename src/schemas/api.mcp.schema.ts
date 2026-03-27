import * as z from 'zod';
import { IdSchema, TimestampSchema } from './common.schema';

/**
 * 🔌 MCP (Model Context Protocol) 스키마
 *
 * AI 쿼리 요청/응답, 컨텍스트 관리, MCP 서버 통신
 */

// ===== MCP 쿼리 요청 =====

export const MCPQueryRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  context: z.record(z.string(), z.string()).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      stream: z.boolean().optional(),
    })
    .optional(),
});

// ===== MCP 쿼리 응답 =====

export const MCPQueryResponseSchema = z.object({
  id: IdSchema,
  queryId: IdSchema,
  response: z.string(),
  relatedServers: z.array(z.string()),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  timestamp: TimestampSchema,
  sources: z.array(z.string()),
  actionable: z.boolean(),
  metadata: z
    .object({
      model: z.string().optional(),
      processingTime: z.number().optional(),
      tokensUsed: z.number().optional(),
    })
    .optional(),
});
// ===== MCP Context Integration 스키마 =====

export const MCPContextIntegrationRequestSchema = z.object({
  action: z.enum(['sync', 'query', 'update']),
  query: z.string().optional(),
  contextType: z.string().optional(),
  nlpType: z
    .enum([
      'intent_analysis',
      'entity_extraction',
      'sentiment_analysis',
      'command_parsing',
    ])
    .optional(),
  maxFiles: z.number().min(1).max(100).optional(),
  includeSystemContext: z.boolean().optional(),
  pathFilters: z.array(z.string()).optional(),
  data: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()])
    )
    .optional(),
  sessionId: z.string().optional(),
  timestamp: TimestampSchema,
});

export const MCPContextIntegrationResponseSchema = z.object({
  success: z.boolean(),
  query: z.string().optional(),
  contextType: z.string().optional(),
  action: z.enum(['sync', 'query', 'update']).optional(),
  data: z.unknown().optional(),
  result: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()])
    )
    .optional(),
  message: z.string().optional(),
  timestamp: TimestampSchema,
});

export const MCPIntegrationStatusResponseSchema = z.object({
  success: z.boolean(),
  timestamp: TimestampSchema,
  data: z.object({
    mcpServer: z.object({
      url: z.string(),
      status: z.enum(['online', 'offline', 'degraded']),
      lastChecked: z.string(),
      responseTime: z.number(),
      version: z.string().optional(),
      capabilities: z.array(z.string()).optional(),
    }),
    contextCache: z.object({
      size: z.number(),
      hitRate: z.number(),
    }),
    ragIntegration: z.object({
      enabled: z.boolean(),
      lastSync: z.string(),
      syncCount: z.number(),
    }),
    performance: z.object({
      avgQueryTime: z.number(),
      totalQueries: z.number(),
      errorRate: z.number(),
    }),
  }),
  capabilities: z.object({
    mcpIntegration: z.boolean(),
    ragIntegration: z.boolean(),
    nlpSupport: z.boolean(),
    contextTypes: z.array(z.string()),
    nlpTypes: z.array(z.string()),
  }),
  endpoints: z.object({
    contextQuery: z.string(),
    ragSync: z.string(),
    mcpHealth: z.string(),
  }),
});

// ===== MCP Sync 스키마 =====

export const MCPSyncRequestSchema = z.object({
  syncType: z
    .enum(['full', 'mcp_only', 'local_only', 'incremental'])
    .optional()
    .default('full'),
  targetServers: z.array(z.string()).optional(),
  fullSync: z.boolean().optional(),
  dataTypes: z.array(z.enum(['context', 'memory', 'cache'])).optional(),
});

export const MCPSyncResponseSchema = z.object({
  success: z.boolean(),
  syncedItems: z.number(),
  failedItems: z.number(),
  details: z.array(
    z.object({
      server: z.string(),
      status: z.enum(['success', 'failed', 'skipped']),
      items: z.number(),
      error: z.string().optional(),
    })
  ),
  timestamp: TimestampSchema,
});

export const MCPSyncStatusResponseSchema = z.object({
  isSyncing: z.boolean(),
  lastSync: TimestampSchema.optional(),
  nextSync: TimestampSchema.optional(),
  syncInterval: z.number(),
  pendingItems: z.number(),
  syncStatus: z
    .object({
      mcpServerOnline: z.boolean(),
      ragIntegrationEnabled: z.boolean(),
      lastSyncTime: z.string().optional(),
      syncCount: z.number(),
    })
    .optional(),
  availableSyncTypes: z
    .array(
      z.object({
        type: z.enum(['full', 'mcp_only', 'local_only', 'incremental']),
        description: z.string(),
        recommendedFor: z.string(),
      })
    )
    .optional(),
  performance: z
    .object({
      avgQueryTime: z.number(),
      totalQueries: z.number(),
      errorRate: z.number(),
    })
    .optional(),
});

// ===== 추가 컨텍스트 스키마 =====

export const MCPNLPContextSchema = z.object({
  query: z.string(),
  language: z.enum(['ko', 'en']),
  intent: z.string().optional(),
  entities: z.array(z.string()).optional(),
  confidence: z.number().optional(),
});

export const MCPContextSchema = z.object({
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  timestamp: TimestampSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const LocalContextBundleSchema = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
      type: z.string(),
    })
  ),
  context: MCPContextSchema,
  nlp: MCPNLPContextSchema.optional(),
});

export const MCPSyncResultSchema = z.object({
  serverId: z.string().optional(),
  success: z.boolean(),
  syncedContexts: z.number().optional(),
  status: z.enum(['success', 'failed', 'partial']).optional(),
  items: z.number().optional(),
  errors: z.array(z.string()).optional(),
  timestamp: TimestampSchema,
  syncType: z
    .enum(['full', 'mcp_only', 'local_only', 'incremental'])
    .optional(),
  message: z.string().optional(),
});

// ===== 타입 내보내기 =====

export type MCPQueryRequest = z.infer<typeof MCPQueryRequestSchema>;
export type MCPQueryResponse = z.infer<typeof MCPQueryResponseSchema>;
export type MCPContextIntegrationRequest = z.infer<
  typeof MCPContextIntegrationRequestSchema
>;
export type MCPContextIntegrationResponse = z.infer<
  typeof MCPContextIntegrationResponseSchema
>;
export type MCPIntegrationStatusResponse = z.infer<
  typeof MCPIntegrationStatusResponseSchema
>;
export type MCPSyncRequest = z.infer<typeof MCPSyncRequestSchema>;
export type MCPSyncResponse = z.infer<typeof MCPSyncResponseSchema>;
export type MCPSyncStatusResponse = z.infer<typeof MCPSyncStatusResponseSchema>;
export type MCPSyncResult = z.infer<typeof MCPSyncResultSchema>;
export type MCPNLPContext = z.infer<typeof MCPNLPContextSchema>;
export type MCPContext = z.infer<typeof MCPContextSchema>;
export type LocalContextBundle = z.infer<typeof LocalContextBundleSchema>;
