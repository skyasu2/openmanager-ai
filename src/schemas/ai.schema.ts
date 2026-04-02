import * as z from 'zod';
import {
  IdSchema,
  MetadataSchema,
  PercentageSchema,
  TimestampSchema,
} from './common.schema';

/**
 * 🤖 AI 관련 Zod 스키마
 *
 * AI 엔진 및 분석에 사용되는 스키마들
 *
 * ## v8.x: Cloud Run Multi-Agent + Gemini Vision 기준 스키마
 */

// ===== AI 엔진 =====

export const AIEngineTypeSchema = z.enum([
  'cloud-run-ai',
  'supabase-rag',
  'korean-ai',
  'mcp-client',
  'gcp-mcp',
  'transformers',
  'mcp-context',
]);

export const AIModelSchema = z.enum([
  // Cloud Run multi-agent models
  'gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'mistral-large-latest',
  'mistral-embed',
  // Vision / auxiliary
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // Compatibility
  'llama-3.3-70b',
  'custom',
]);

export const AIEngineStatusSchema = z.object({
  engine: AIEngineTypeSchema,
  status: z.enum(['active', 'inactive', 'error', 'rate-limited']),
  model: AIModelSchema.optional(),
  lastCheck: TimestampSchema,
  responseTime: z.number().optional(), // ms
  tokensUsed: z.number().optional(),
  tokensRemaining: z.number().optional(),
  errorMessage: z.string().optional(),
});

// ===== AI 쿼리 =====

export const AIQueryOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(1000),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().positive().optional(),
  stream: z.boolean().default(false),
  stopSequences: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  contextWindow: z.number().positive().optional(),
});

export const AIQueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  engine: AIEngineTypeSchema.optional(),
  context: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
        timestamp: TimestampSchema.optional(),
      })
    )
    .optional(),
  options: AIQueryOptionsSchema.optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
});

export const AIQueryResponseSchema = z.object({
  id: IdSchema,
  query: z.string(),
  response: z.string(),
  engine: AIEngineTypeSchema,
  model: AIModelSchema.optional(),
  confidence: PercentageSchema,
  processingTime: z.number(), // ms
  tokensUsed: z
    .object({
      prompt: z.number(),
      completion: z.number(),
      total: z.number(),
    })
    .optional(),
  metadata: z
    .object({
      sources: z.array(z.string()).optional(),
      citations: z
        .array(
          z.object({
            text: z.string(),
            source: z.string(),
            confidence: PercentageSchema,
          })
        )
        .optional(),
      relatedTopics: z.array(z.string()).optional(),
    })
    .optional(),
  timestamp: TimestampSchema,
});

// ===== AI 분석 =====

export const AnomalyTypeSchema = z.enum([
  'cpu_spike',
  'memory_leak',
  'disk_full',
  'network_anomaly',
  'response_time',
  'error_rate',
  'security_threat',
  'configuration_drift',
  'pattern_deviation',
]);

export const AnomalyDetectionSchema = z.object({
  id: IdSchema,
  serverId: IdSchema,
  type: AnomalyTypeSchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: PercentageSchema,
  description: z.string(),
  detectedAt: TimestampSchema,
  metrics: z.record(z.string(), z.number()),
  baseline: z.record(z.string(), z.number()).optional(),
  recommendation: z.string().optional(),
  falsePositive: z.boolean().default(false),
});

export const PredictionSchema = z.object({
  id: IdSchema,
  targetId: IdSchema,
  metric: z.string(),
  timeframe: z.enum(['1h', '6h', '24h', '7d', '30d']),
  predictions: z.array(
    z.object({
      timestamp: TimestampSchema,
      value: z.number(),
      confidence: PercentageSchema,
      upperBound: z.number().optional(),
      lowerBound: z.number().optional(),
    })
  ),
  modelInfo: z.object({
    algorithm: z.string(),
    accuracy: PercentageSchema,
    lastTrained: TimestampSchema,
    features: z.array(z.string()),
  }),
});

// ===== AI 인사이트 =====

export const InsightTypeSchema = z.enum([
  'performance_optimization',
  'cost_saving',
  'security_improvement',
  'capacity_planning',
  'maintenance_window',
  'configuration_recommendation',
  'anomaly_explanation',
]);

export const AIInsightSchema = z.object({
  id: IdSchema,
  type: InsightTypeSchema,
  title: z.string(),
  description: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  confidence: PercentageSchema,
  affectedResources: z.array(IdSchema),
  recommendations: z.array(
    z.object({
      action: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      estimatedImpact: z.string(),
      implementation: z.string().optional(),
    })
  ),
  supportingData: z.record(z.string(), z.unknown()).optional(),
  generatedAt: TimestampSchema,
  expiresAt: TimestampSchema.optional(),
});

// ===== 한국어 NLP =====

export const KoreanNLPRequestSchema = z.object({
  text: z.string().min(1),
  task: z.enum([
    'tokenization',
    'pos_tagging',
    'ner',
    'sentiment_analysis',
    'summarization',
    'translation',
    'question_answering',
  ]),
  options: z
    .object({
      language: z.enum(['ko', 'en']).default('ko'),
      returnOriginal: z.boolean().default(false),
      detailed: z.boolean().default(false),
    })
    .optional(),
});

export const KoreanNLPResponseSchema = z.object({
  task: z.string(),
  result: z.union([
    z.array(z.string()), // tokenization
    z.array(
      z.object({
        // pos_tagging
        token: z.string(),
        pos: z.string(),
      })
    ),
    z.array(
      z.object({
        // ner
        entity: z.string(),
        type: z.string(),
        start: z.number(),
        end: z.number(),
      })
    ),
    z.object({
      // sentiment_analysis
      sentiment: z.enum(['positive', 'negative', 'neutral']),
      confidence: PercentageSchema,
      scores: z.object({
        positive: PercentageSchema,
        negative: PercentageSchema,
        neutral: PercentageSchema,
      }),
    }),
    z.string(), // summarization, translation
    z.object({
      // question_answering
      answer: z.string(),
      confidence: PercentageSchema,
      context: z.string().optional(),
    }),
  ]),
  processingTime: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ===== AI 학습 =====

export const TrainingDataSchema = z.object({
  id: IdSchema,
  type: z.enum(['metrics', 'logs', 'events', 'feedback']),
  data: z.array(z.record(z.string(), z.unknown())),
  labels: z.array(z.unknown()).optional(),
  metadata: MetadataSchema,
});

export const ModelTrainingRequestSchema = z.object({
  modelType: z.enum(['anomaly_detection', 'prediction', 'classification']),
  dataset: z.array(TrainingDataSchema),
  parameters: z.object({
    algorithm: z.string(),
    epochs: z.number().positive().optional(),
    batchSize: z.number().positive().optional(),
    learningRate: z.number().positive().optional(),
    validationSplit: z.number().min(0).max(1).optional(),
    customParams: z.record(z.string(), z.unknown()).optional(),
  }),
  evaluationMetrics: z.array(z.string()).optional(),
});
