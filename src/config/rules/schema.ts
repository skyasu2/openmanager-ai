import { z } from 'zod';
import type { AlertRule, MetricThreshold } from './types';

export const MetricThresholdSchema = z.object({
  warning: z.number(),
  critical: z.number(),
  description: z.string().optional(),
});

const ServerStatusRuleSchema = z.object({
  name: z.string(),
  condition: z.string(),
  resultStatus: z.enum(['online', 'warning', 'critical', 'offline']),
  priority: z.number(),
  for: z.string().optional(),
});

const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  metricType: z.enum(['cpu', 'memory', 'disk', 'network', 'response_time']),
  operator: z.enum(['>', '>=', '<', '<=', '==', '!=']),
  threshold: z.number(),
  severity: z.enum(['info', 'warning', 'critical']),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const SystemRulesSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  thresholds: z.object({
    cpu: MetricThresholdSchema,
    memory: MetricThresholdSchema,
    disk: MetricThresholdSchema,
    network: MetricThresholdSchema,
    responseTime: MetricThresholdSchema,
  }),
  statusRules: z.array(ServerStatusRuleSchema),
  alertRules: z.array(AlertRuleSchema),
  metadata: z.object({
    description: z.string(),
    maintainer: z.string(),
    aiInstructions: z.string(),
  }),
});

export interface SystemRuleRecord {
  category: string;
  key: string;
  value: MetricThreshold | AlertRule | string;
  description?: string;
  enabled?: boolean;
}
