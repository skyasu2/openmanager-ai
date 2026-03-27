/**
 * Supervisor Request Schemas Tests
 *
 * @description Zod 스키마 검증 테스트 (파일 파트 빈 문자열 검증 포함)
 * @created 2026-01-27
 * @updated 2026-01-28 - Import actual schema instead of local copy (Codex review fix)
 */

import { describe, expect, it } from 'vitest';

// 🎯 Fix: Import actual schema to prevent drift between test and production
import { filePartSchema, requestSchemaLoose } from './schemas';

describe('filePartSchema validation', () => {
  describe('빈 문자열 검증', () => {
    it('빈 data와 빈 url 문자열은 거부한다', () => {
      const invalidPart = {
        type: 'file' as const,
        data: '',
        url: '',
      };

      const result = filePartSchema.safeParse(invalidPart);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'File part must include non-empty data or url field'
        );
      }
    });

    it('빈 data만 있으면 거부한다', () => {
      const invalidPart = {
        type: 'file' as const,
        data: '',
      };

      const result = filePartSchema.safeParse(invalidPart);
      expect(result.success).toBe(false);
    });

    it('빈 url만 있으면 거부한다', () => {
      const invalidPart = {
        type: 'file' as const,
        url: '',
      };

      const result = filePartSchema.safeParse(invalidPart);
      expect(result.success).toBe(false);
    });

    it('data도 url도 없으면 거부한다', () => {
      const invalidPart = {
        type: 'file' as const,
      };

      const result = filePartSchema.safeParse(invalidPart);
      expect(result.success).toBe(false);
    });
  });

  describe('유효한 파일 파트', () => {
    it('유효한 data 필드를 허용한다', () => {
      const validPart = {
        type: 'file' as const,
        data: 'base64encodedcontent',
      };

      const result = filePartSchema.safeParse(validPart);
      expect(result.success).toBe(true);
    });

    it('유효한 url 필드를 허용한다', () => {
      const validPart = {
        type: 'file' as const,
        url: 'data:image/png;base64,iVBORw0KGgo=',
      };

      const result = filePartSchema.safeParse(validPart);
      expect(result.success).toBe(true);
    });

    it('data와 url이 모두 있으면 허용한다', () => {
      const validPart = {
        type: 'file' as const,
        data: 'base64content',
        url: 'https://example.com/file.pdf',
      };

      const result = filePartSchema.safeParse(validPart);
      expect(result.success).toBe(true);
    });

    it('모든 선택적 필드를 포함한 유효한 파트를 허용한다', () => {
      const validPart = {
        type: 'file' as const,
        data: 'base64encodedcontent',
        url: 'https://example.com/document.pdf',
        mediaType: 'application/pdf' as const,
        mimeType: 'application/pdf',
        filename: 'document.pdf',
        name: 'My Document',
      };

      const result = filePartSchema.safeParse(validPart);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('공백만 있는 data는 거부한다 (trim 후 길이 0)', () => {
      // 🎯 Fix: 공백만 있는 경우는 이제 거부됨 (trim 검증 추가)
      const edgeCasePart = {
        type: 'file' as const,
        data: '   ',
      };

      const result = filePartSchema.safeParse(edgeCasePart);
      expect(result.success).toBe(false);
    });

    it('단일 문자 data는 허용한다', () => {
      const minimalPart = {
        type: 'file' as const,
        data: 'a',
      };

      const result = filePartSchema.safeParse(minimalPart);
      expect(result.success).toBe(true);
    });

    it('공백만 있는 url도 거부한다', () => {
      const edgeCasePart = {
        type: 'file' as const,
        url: '   ',
      };

      const result = filePartSchema.safeParse(edgeCasePart);
      expect(result.success).toBe(false);
    });
  });
});

/**
 * requestSchemaLoose Tests (V2 Proxy)
 *
 * V2 프록시 모드에서 사용하는 느슨한 스키마 검증 테스트
 * Cloud Run에서 최종 검증이 이루어지므로 Vercel 단에서는 최소 검증만 수행
 */
describe('requestSchemaLoose (V2 Proxy)', () => {
  describe('유효한 요청', () => {
    it('should accept minimal message structure', () => {
      const input = {
        messages: [{ role: 'user', content: 'test' }],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept message with parts array', () => {
      const input = {
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept unknown part types (passthrough)', () => {
      const input = {
        messages: [
          {
            role: 'user',
            parts: [{ type: 'unknown-future-type', data: 'test' }],
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept message with optional sessionId', () => {
      const input = {
        messages: [{ role: 'user', content: 'test' }],
        sessionId: 'session-123',
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept enableRAG flag', () => {
      const input = {
        messages: [{ role: 'user', content: 'test' }],
        enableRAG: true,
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.enableRAG).toBe(true);
    });

    it('should accept message with createdAt as string', () => {
      const input = {
        messages: [
          {
            role: 'user',
            content: 'test',
            createdAt: '2026-01-27T10:00:00Z',
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept message with createdAt as Date', () => {
      const input = {
        messages: [
          {
            role: 'user',
            content: 'test',
            createdAt: new Date(),
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('유효하지 않은 요청', () => {
    it('should reject empty messages array', () => {
      const input = { messages: [] };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject messages exceeding max limit (50)', () => {
      const input = {
        messages: Array(51).fill({ role: 'user', content: 'x' }),
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject message without role', () => {
      const input = {
        messages: [{ content: 'test' }],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid role value', () => {
      const input = {
        messages: [{ role: 'invalid-role', content: 'test' }],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing messages field', () => {
      const input = { sessionId: 'session-123' };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject message without content or parts', () => {
      const input = {
        messages: [{ role: 'user' }],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject file parts with unsupported mediaType', () => {
      const input = {
        messages: [
          {
            role: 'user',
            parts: [
              {
                type: 'file',
                data: 'ZmFrZQ==',
                mediaType: 'application/x-msdownload',
              },
            ],
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should accept exactly 50 messages (boundary)', () => {
      const input = {
        messages: Array(50).fill({ role: 'user', content: 'x' }),
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid roles', () => {
      const roles = ['user', 'assistant', 'system'] as const;

      for (const role of roles) {
        const input = {
          messages: [{ role, content: 'test' }],
        };

        const result = requestSchemaLoose.safeParse(input);
        expect(result.success).toBe(true);
      }
    });

    it('should accept parts with extra fields (passthrough)', () => {
      const input = {
        messages: [
          {
            role: 'user',
            parts: [
              {
                type: 'file',
                url: 'data:image/png;base64,abc',
                customField: 'extra-data',
              },
            ],
          },
        ],
      };

      const result = requestSchemaLoose.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
