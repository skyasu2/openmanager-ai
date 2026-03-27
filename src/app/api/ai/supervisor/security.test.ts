/**
 * Security Module Unit Tests
 *
 * @description 입력 정제 및 출력 필터링 로직 검증
 * @created 2026-01-10 v5.84.3
 */
import { describe, expect, it } from 'vitest';

import {
  escapeHtml,
  filterResponse,
  quickFilter,
  quickSanitize,
  safeOutput,
  sanitizeInput,
} from './security';

describe('security', () => {
  describe('sanitizeInput', () => {
    describe('length truncation', () => {
      it('should not modify short text', () => {
        const result = sanitizeInput('Hello World');
        expect(result.sanitized).toBe('Hello World');
        expect(result.wasModified).toBe(false);
        expect(result.modifications).toHaveLength(0);
      });

      it('should truncate text longer than 10000 chars', () => {
        const longText = 'a'.repeat(15000);
        const result = sanitizeInput(longText);
        expect(result.sanitized.length).toBe(10000);
        expect(result.wasModified).toBe(true);
        expect(result.modifications).toContain('truncated_to_10000_chars');
      });
    });

    describe('sensitive info masking', () => {
      it('should mask API keys', () => {
        const result = sanitizeInput('My api_key=sk-abc123xyz');
        expect(result.sanitized).toContain('[REDACTED]');
        expect(result.wasModified).toBe(true);
        expect(result.modifications).toContain('sensitive_info_masked');
      });

      it('should mask tokens', () => {
        // Pattern expects token=value or token:value format
        const result = sanitizeInput('token=eyJhbGciOiJIUzI1NiJ9');
        expect(result.sanitized).toContain('[REDACTED]');
      });

      it('should mask passwords', () => {
        const result = sanitizeInput('password=mysecretpass123');
        expect(result.sanitized).toContain('[REDACTED]');
      });

      it('should mask secret keys', () => {
        const result = sanitizeInput('secret_key=abcd1234');
        expect(result.sanitized).toContain('[REDACTED]');
      });

      it('should mask private keys', () => {
        const result = sanitizeInput('private_key: xyz789');
        expect(result.sanitized).toContain('[REDACTED]');
      });

      it('should not mask normal text', () => {
        const result = sanitizeInput('This is a normal message');
        expect(result.sanitized).toBe('This is a normal message');
        expect(result.wasModified).toBe(false);
      });
    });
  });

  describe('filterResponse', () => {
    describe('length truncation', () => {
      it('should not modify short response', () => {
        const result = filterResponse('Short response');
        expect(result.filtered).toBe('Short response');
        expect(result.wasFiltered).toBe(false);
      });

      it('should truncate response longer than 50000 chars', () => {
        const longResponse = 'b'.repeat(60000);
        const result = filterResponse(longResponse);
        expect(result.filtered.length).toBeLessThan(60000);
        expect(result.wasFiltered).toBe(true);
        expect(result.reasons).toContain('truncated_to_50000_chars');
      });
    });

    describe('dangerous content removal', () => {
      it('should remove script tags', () => {
        // Testing XSS pattern removal
        const scriptTag = '<' + 'script>alert(1)</' + 'script>';
        const result = filterResponse(scriptTag);
        expect(result.filtered).toContain('[removed]');
        expect(result.wasFiltered).toBe(true);
      });

      it('should remove event handlers', () => {
        const eventHandler = '<img src="x" on' + 'error="alert(1)">';
        const result = filterResponse(eventHandler);
        expect(result.filtered).toContain('[removed]');
      });

      it('should remove javascript URLs', () => {
        const jsUrl = '<a href="java' + 'script:void(0)">';
        const result = filterResponse(jsUrl);
        expect(result.filtered).toContain('[removed]');
      });

      it('should not filter safe content', () => {
        const safeContent = 'This is a safe response with normal text.';
        const result = filterResponse(safeContent);
        expect(result.filtered).toBe(safeContent);
        expect(result.wasFiltered).toBe(false);
      });
    });
  });

  describe('quickSanitize', () => {
    it('should return sanitized string only', () => {
      const result = quickSanitize('api_key=secret123');
      expect(typeof result).toBe('string');
      expect(result).toContain('[REDACTED]');
    });

    it('should handle normal text', () => {
      const result = quickSanitize('Hello');
      expect(result).toBe('Hello');
    });
  });

  describe('quickFilter', () => {
    it('should return filtered string only', () => {
      const scriptTag = '<' + 'script>bad</' + 'script>';
      const result = quickFilter(scriptTag);
      expect(typeof result).toBe('string');
      expect(result).toContain('[removed]');
    });

    it('should handle safe text', () => {
      const result = quickFilter('Safe text');
      expect(result).toBe('Safe text');
    });
  });

  describe('escapeHtml', () => {
    it('should escape < and >', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape &', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
      expect(escapeHtml("'world'")).toBe('&#x27;world&#x27;');
    });

    it('should escape all special chars together', () => {
      const result = escapeHtml('<a href="test">link & text</a>');
      expect(result).toBe(
        '&lt;a href=&quot;test&quot;&gt;link &amp; text&lt;/a&gt;'
      );
    });

    it('should not modify safe text', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('safeOutput', () => {
    it('should apply both filtering and escaping', () => {
      const input = '<b>text</b>';
      const result = safeOutput(input);
      // HTML should be escaped
      expect(result).toContain('&lt;b&gt;');
    });

    it('should handle safe input', () => {
      const result = safeOutput('Normal text');
      expect(result).toBe('Normal text');
    });

    it('should escape remaining HTML after filtering', () => {
      const result = safeOutput('<p>Paragraph</p>');
      expect(result).toBe('&lt;p&gt;Paragraph&lt;/p&gt;');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeInput('').sanitized).toBe('');
      expect(filterResponse('').filtered).toBe('');
      expect(escapeHtml('')).toBe('');
    });

    it('should handle Korean text', () => {
      const korean = '안녕하세요 서버 상태입니다';
      expect(sanitizeInput(korean).sanitized).toBe(korean);
      expect(filterResponse(korean).filtered).toBe(korean);
    });

    it('should handle mixed content with sensitive data', () => {
      const mixed = '서버 상태: api_key=test123';
      const sanitized = sanitizeInput(mixed).sanitized;
      expect(sanitized).toContain('[REDACTED]');
    });
  });
});
