/**
 * Zod Schemas for Multi-Agent Orchestration
 *
 * Type-safe structured output schemas for generateObject.
 * Replaces unsafe regex parsing with validated structured responses.
 *
 * @version 1.0.0
 * @created 2026-01-24
 */

import { z } from 'zod';

// ============================================================================
// Agent Routing Schema (Priority 1)
// ============================================================================

/**
 * Available agent names as a const array for type safety
 * @updated 2026-01-27 - Added Vision Agent
 */
export const AGENT_NAMES = ['NLQ Agent', 'Analyst Agent', 'Reporter Agent', 'Advisor Agent', 'Vision Agent'] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

/**
 * Routing decision schema for orchestrator
 * Used with generateObject for type-safe agent selection
 */
export const routingSchema = z.object({
  selectedAgent: z.enum(['NLQ Agent', 'Analyst Agent', 'Reporter Agent', 'Advisor Agent', 'Vision Agent', 'NONE']),
  confidence: z.number().min(0).max(1).describe('Routing confidence score (0-1)'),
  reasoning: z.string().describe('Brief explanation for the routing decision'),
});

export type RoutingDecision = z.infer<typeof routingSchema>;

// ============================================================================
// Task Decomposition Schema (Priority 3)
// ============================================================================

/**
 * Subtask definition for complex query decomposition
 * @updated 2026-01-27 - Added Vision Agent
 */
export const subtaskSchema = z.object({
  task: z.string().describe('Specific subtask description'),
  agent: z.enum(['NLQ Agent', 'Analyst Agent', 'Reporter Agent', 'Advisor Agent', 'Vision Agent']),
  priority: z.number().min(1).max(5).optional().describe('Priority (1=highest)'),
});

/**
 * Task decomposition schema for orchestrator-worker pattern
 * Used when a complex query needs to be split into subtasks
 */
export const taskDecomposeSchema = z.object({
  subtasks: z.array(subtaskSchema).min(1).max(4).describe('List of subtasks to execute'),
  requiresSequential: z.boolean().describe('Whether subtasks must run in sequence'),
  unificationStrategy: z.enum(['merge', 'summarize', 'prioritize']).optional()
    .describe('How to combine results from multiple agents'),
});

export type TaskDecomposition = z.infer<typeof taskDecomposeSchema>;
export type Subtask = z.infer<typeof subtaskSchema>;

// ============================================================================
// Analysis Result Schema
// ============================================================================

/**
 * Anomaly detection result schema
 */
export const anomalySchema = z.object({
  detected: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  affectedServers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    issue: z.string(),
    metrics: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      disk: z.number().optional(),
    }).optional(),
  })),
  summary: z.string(),
  recommendations: z.array(z.string()).optional(),
});

export type AnomalyResult = z.infer<typeof anomalySchema>;

// ============================================================================
// Report Generation Schema
// ============================================================================

/**
 * Timeline event schema for incident reports
 */
export const timelineEventSchema = z.object({
  timestamp: z.string(),
  eventType: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  description: z.string(),
});

/**
 * Root cause analysis schema
 */
export const rootCauseSchema = z.object({
  cause: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  suggestedFix: z.string(),
});

/**
 * Incident report schema
 */
export const incidentReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  affectedServers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    primaryIssue: z.string(),
  })),
  timeline: z.array(timelineEventSchema),
  rootCause: rootCauseSchema.nullable(),
  suggestedActions: z.array(z.string()),
  sla: z.object({
    targetUptime: z.number(),
    actualUptime: z.number(),
    slaViolation: z.boolean(),
  }).optional(),
});

export type IncidentReport = z.infer<typeof incidentReportSchema>;

// ============================================================================
// Server Query Result Schema
// ============================================================================

/**
 * NLQ query result schema for structured server data responses
 */
export const serverQueryResultSchema = z.object({
  queryType: z.enum(['list', 'filter', 'aggregate', 'compare', 'status']),
  servers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['normal', 'warning', 'critical']),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
  })).optional(),
  aggregation: z.object({
    metric: z.string(),
    operation: z.enum(['avg', 'max', 'min', 'sum', 'count']),
    value: z.number(),
    unit: z.string().optional(),
  }).optional(),
  summary: z.string(),
});

export type ServerQueryResult = z.infer<typeof serverQueryResultSchema>;

// ============================================================================
// Advisor Recommendation Schema
// ============================================================================

/**
 * Troubleshooting recommendation schema
 */
export const recommendationSchema = z.object({
  problem: z.string(),
  diagnosis: z.string(),
  solutions: z.array(z.object({
    title: z.string(),
    description: z.string(),
    commands: z.array(z.string()).optional(),
    priority: z.enum(['immediate', 'short-term', 'long-term']),
  })),
  relatedCases: z.array(z.object({
    title: z.string(),
    similarity: z.number(),
    resolution: z.string(),
  })).optional(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate if a string is a valid agent name
 */
export function isValidAgentName(name: string): name is AgentName {
  return AGENT_NAMES.includes(name as AgentName);
}

/**
 * Get agent name from routing decision, with fallback
 */
export function getAgentFromRouting(decision: RoutingDecision): AgentName | null {
  if (decision.selectedAgent === 'NONE') {
    return null;
  }
  return decision.selectedAgent;
}
