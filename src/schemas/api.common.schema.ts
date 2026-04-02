import * as z from 'zod';
import { BaseResponseSchema, ErrorResponseSchema } from './common.schema';

/**
 * 🔗 API 공통 스키마
 *
 * API 요청/응답에서 공통으로 사용되는 래퍼와 배치 작업 스키마들
 */

// ===== API 응답 래퍼 =====

const _ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  BaseResponseSchema.extend({
    success: z.literal(true),
    data: dataSchema,
    metadata: z.record(z.string(), z.string()).optional(),
  });

const _ApiErrorResponseSchema = ErrorResponseSchema.extend({
  statusCode: z.number().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
});

// ===== 배치 작업 =====

const _BatchRequestSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema).min(1).max(100),
    options: z
      .object({
        parallel: z.boolean().default(false),
        continueOnError: z.boolean().default(false),
        timeout: z.number().positive().optional(),
      })
      .optional(),
  });

const _BatchResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.array(itemSchema),
    failed: z.array(
      z.object({
        item: z.unknown(),
        error: z.string(),
        index: z.number(),
      })
    ),
    total: z.number(),
    successCount: z.number(),
    failedCount: z.number(),
  });
