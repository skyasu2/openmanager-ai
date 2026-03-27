import { z } from 'zod';

export const aiFeedbackTraceUrlStatusSchema = z.enum([
  'available',
  'unavailable',
]);

export const aiFeedbackLangfuseStatusSchema = z.enum([
  'skipped',
  'success',
  'error',
]);

export const cloudRunFeedbackProxyPayloadSchema = z
  .object({
    traceApiUrl: z.string().url().optional(),
    dashboardUrl: z.string().url().optional(),
    traceUrlStatus: aiFeedbackTraceUrlStatusSchema.optional(),
    traceUrl: z.string().url().optional(),
    monitoringLookupUrl: z.string().url().optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.traceUrl && value.traceUrlStatus !== 'available') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traceUrlStatus'],
        message: 'traceUrl requires traceUrlStatus=available',
      });
    }

    if (value.traceUrlStatus === 'available' && !value.traceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traceUrl'],
        message: 'traceUrlStatus=available requires traceUrl',
      });
    }
  });

export const aiFeedbackResponseSchema = z
  .object({
    success: z.literal(true),
    message: z.literal('Feedback recorded'),
    feedbackId: z.string().min(1),
    stored: z.enum(['database', 'log_only']),
    langfuseStatus: aiFeedbackLangfuseStatusSchema,
    traceId: z.string().optional(),
    traceApiUrl: z.string().url().optional(),
    dashboardUrl: z.string().url().optional(),
    traceUrlStatus: aiFeedbackTraceUrlStatusSchema.optional(),
    traceUrl: z.string().url().optional(),
    monitoringLookupUrl: z.string().url().optional(),
  })
  .superRefine((value, ctx) => {
    const hasTraceContext =
      Boolean(value.traceId) ||
      Boolean(value.traceApiUrl) ||
      Boolean(value.dashboardUrl) ||
      Boolean(value.traceUrlStatus) ||
      Boolean(value.traceUrl) ||
      Boolean(value.monitoringLookupUrl);

    if (hasTraceContext && !value.traceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traceId'],
        message: 'trace context requires traceId',
      });
    }

    if (value.traceUrl && value.traceUrlStatus !== 'available') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traceUrlStatus'],
        message: 'traceUrl requires traceUrlStatus=available',
      });
    }

    if (value.traceUrlStatus === 'available' && !value.traceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['traceUrl'],
        message: 'traceUrlStatus=available requires traceUrl',
      });
    }
  });

export type CloudRunFeedbackProxyPayload = z.infer<
  typeof cloudRunFeedbackProxyPayloadSchema
>;
export type AIFeedbackResponse = z.infer<typeof aiFeedbackResponseSchema>;
