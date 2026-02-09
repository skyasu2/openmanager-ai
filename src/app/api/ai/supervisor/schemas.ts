/**
 * 📋 Supervisor Request Schemas (Zod Validation)
 *
 * AI SDK v5 UIMessage 'parts' 포맷 및 레거시 'content' 포맷 모두 지원
 * 파일/이미지 첨부에 대한 상세 검증 포함
 *
 * @created 2026-01-10 (route.ts에서 분리)
 * @updated 2026-01-27 (멀티모달 파일 검증 강화)
 */

import { z } from 'zod';

// ============================================================================
// Part Schemas
// ============================================================================

// AI SDK v5 UIMessage 'parts' 포맷
const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

/**
 * 파일 파트 스키마 (PDF, audio, documents, images via file type)
 * 🎯 Fix: url/mediaType (클라이언트) + data/mimeType (서버) 모두 지원
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#file-parts
 * @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#files
 */
export const filePartSchema = z
  .object({
    type: z.literal('file'),
    // 파일 데이터 (서버 측, Base64 또는 data URL)
    // Base64 문자열 길이 제한: 실제 바이너리 ≈ string.length * 0.75
    // 10MB 바이너리 ≈ 13.3MB Base64 문자열
    data: z
      .string()
      .max(14 * 1024 * 1024, '파일 크기가 10MB를 초과합니다')
      .optional(),
    // 파일 URL (클라이언트 측, data URL 포함)
    url: z
      .string()
      .max(14 * 1024 * 1024, '파일 크기가 10MB를 초과합니다')
      .optional(),
    // AI SDK uses 'mediaType' for FilePart (클라이언트 측)
    mediaType: z
      .enum([
        'application/pdf',
        'text/plain',
        'text/markdown',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        // 이미지 타입도 file 파트로 전송될 수 있음
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
      ])
      .optional(),
    // 서버 측 mimeType 필드도 허용
    mimeType: z.string().optional(),
    // 선택적 파일명 (두 가지 필드명 모두 지원)
    filename: z.string().max(255).optional(),
    name: z.string().max(255).optional(),
  })
  .refine(
    (part) =>
      (typeof part.data === 'string' && part.data.trim().length > 0) ||
      (typeof part.url === 'string' && part.url.trim().length > 0),
    { message: 'File part must include non-empty data or url field' }
  );

/**
 * 이미지 파트 스키마
 * @see https://ai-sdk.dev/docs/ai-sdk-core/prompts#image-parts
 */
const imagePartSchema = z.object({
  type: z.literal('image'),
  // Base64 data URL 또는 HTTP(S) URL
  // 10MB 바이너리 ≈ 13.3MB Base64 문자열
  image: z.string().max(14 * 1024 * 1024, '이미지 크기가 10MB를 초과합니다'),
  // 선택적 MIME 타입 (이미지는 AI SDK가 자동 감지 가능)
  mimeType: z
    .enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
    .optional(),
});

// AI SDK v5+ 호환성: 모든 part 타입 허용 (union으로 유연성 확보)
// discriminatedUnion은 알 수 없는 타입에서 실패하므로 union 사용
const partSchema = z.union([
  textPartSchema,
  filePartSchema,
  imagePartSchema,
  z.object({ type: z.literal('tool-invocation') }).passthrough(),
  z.object({ type: z.literal('tool-result') }).passthrough(),
  z.object({ type: z.literal('reasoning') }).passthrough(),
  z.object({ type: z.literal('source') }).passthrough(),
  z.object({ type: z.literal('step-start') }).passthrough(),
  z.object({ type: z.literal('step-finish') }).passthrough(),
  // Fallback: 알 수 없는 타입도 허용 (AI SDK 업데이트 대응)
  z
    .object({ type: z.string() })
    .passthrough(),
]);

// 하이브리드 메시지 스키마: AI SDK v5 (parts) + 레거시 (content) 모두 지원
export const messageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system']),
    // AI SDK v5: parts 배열 (UIMessage 포맷)
    parts: z.array(partSchema).optional(),
    // 레거시: content 문자열
    content: z.string().optional(),
    // 추가 메타데이터 허용
    createdAt: z.union([z.string(), z.date()]).optional(),
  })
  .refine(
    (msg) =>
      (Array.isArray(msg.parts) && msg.parts.length > 0) ||
      (typeof msg.content === 'string' && msg.content.trim().length > 0),
    { message: 'Message must include non-empty parts array or content string' }
  );

export const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
  sessionId: z.string().optional(),
});

/**
 * 프록시 모드용 느슨한 스키마 (V2 전용)
 * Cloud Run에서 최종 검증이 이루어지므로 Vercel 단에서는 최소 검증만 수행
 * @see stream/v2/route.ts
 */
export const requestSchemaLoose = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(['user', 'assistant', 'system']),
        parts: z.array(z.object({ type: z.string() }).passthrough()).optional(),
        content: z.string().optional(),
        createdAt: z.union([z.string(), z.date()]).optional(),
      })
    )
    .min(1)
    .max(50),
  sessionId: z.string().optional(),
  enableWebSearch: z.boolean().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Cloud Run AI 응답 스키마 (타입 단언 제거)
 * @created 2026-01-28
 */
export const cloudRunResponseSchema = z.object({
  success: z.boolean().optional(),
  response: z.string().optional(),
  error: z.string().optional(),
});

export type CloudRunResponse = z.infer<typeof cloudRunResponseSchema>;

// Export types for external use
export type FilePartSchema = z.infer<typeof filePartSchema>;
export type MessageSchema = z.infer<typeof messageSchema>;
export type RequestSchema = z.infer<typeof requestSchema>;
export type RequestSchemaLoose = z.infer<typeof requestSchemaLoose>;
