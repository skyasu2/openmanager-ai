import { describe, expect, it, vi } from 'vitest';

// Mock logger
vi.mock('./logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

import {
  containsChineseCharacters,
  containsForeignCharacters,
  sanitizeChineseCharacters,
  sanitizeJsonStrings,
} from './text-sanitizer';

// ============================================================================
// containsChineseCharacters
// ============================================================================

describe('containsChineseCharacters', () => {
  it('should detect Chinese characters', () => {
    expect(containsChineseCharacters('服务器状态正常')).toBe(true);
    expect(containsChineseCharacters('test 异常 detected')).toBe(true);
  });

  it('should return false for Korean/English text', () => {
    expect(containsChineseCharacters('서버 상태 정상')).toBe(false);
    expect(containsChineseCharacters('server status ok')).toBe(false);
    expect(containsChineseCharacters('CPU 85%')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(containsChineseCharacters('')).toBe(false);
  });
});

// ============================================================================
// containsForeignCharacters
// ============================================================================

describe('containsForeignCharacters', () => {
  it('should detect Cyrillic characters', () => {
    expect(containsForeignCharacters('цикл')).toBe(true);
  });

  it('should detect Japanese characters', () => {
    expect(containsForeignCharacters('セント')).toBe(true);
    expect(containsForeignCharacters('ひらがな')).toBe(true);
  });

  it('should detect Thai characters', () => {
    expect(containsForeignCharacters('สวัสดี')).toBe(true);
  });

  it('should detect Arabic characters', () => {
    expect(containsForeignCharacters('مرحبا')).toBe(true);
  });

  it('should return false for Korean/English/Chinese', () => {
    expect(containsForeignCharacters('서버 server 服务器')).toBe(false);
  });
});

// ============================================================================
// sanitizeChineseCharacters
// ============================================================================

describe('sanitizeChineseCharacters', () => {
  it('should replace known Chinese phrases with Korean', () => {
    expect(sanitizeChineseCharacters('服务器 稳定')).toContain('서버');
    expect(sanitizeChineseCharacters('服务器 稳定')).toContain('안정적');
  });

  it('should replace status terms', () => {
    expect(sanitizeChineseCharacters('正常')).toBe('정상');
    expect(sanitizeChineseCharacters('异常')).toBe('이상');
    expect(sanitizeChineseCharacters('警告')).toBe('경고');
    expect(sanitizeChineseCharacters('严重')).toBe('심각');
  });

  it('should replace system terms', () => {
    expect(sanitizeChineseCharacters('内存 사용률')).toContain('메모리');
    expect(sanitizeChineseCharacters('磁盘 공간')).toContain('디스크');
    expect(sanitizeChineseCharacters('网络 상태')).toContain('네트워크');
  });

  it('should replace analysis terms', () => {
    expect(sanitizeChineseCharacters('原因 분석')).toContain('원인');
    expect(sanitizeChineseCharacters('解决 방법')).toContain('해결');
    expect(sanitizeChineseCharacters('建议 사항')).toContain('권장');
  });

  it('should remove unknown Chinese characters', () => {
    const result = sanitizeChineseCharacters('test 龍 text');
    expect(containsChineseCharacters(result)).toBe(false);
    expect(result).toContain('test');
    expect(result).toContain('text');
  });

  it('should replace known foreign words', () => {
    expect(sanitizeChineseCharacters('hiện 상태')).toContain('현재');
    expect(sanitizeChineseCharacters('Lösung 찾기')).toContain('해결책');
  });

  it('should remove unknown Cyrillic/Japanese characters', () => {
    const result = sanitizeChineseCharacters('test абв text');
    expect(containsForeignCharacters(result)).toBe(false);
  });

  it('should clean up double spaces after removal', () => {
    const result = sanitizeChineseCharacters('test  龍  text');
    expect(result).not.toContain('  ');
  });

  it('should pass through clean Korean/English text unchanged', () => {
    const clean = '서버 CPU 사용률 45%';
    expect(sanitizeChineseCharacters(clean)).toBe(clean);
  });

  it('should handle empty/null-like input', () => {
    expect(sanitizeChineseCharacters('')).toBe('');
  });
});

// ============================================================================
// sanitizeJsonStrings
// ============================================================================

describe('sanitizeJsonStrings', () => {
  it('should sanitize string values', () => {
    const result = sanitizeJsonStrings('正常 상태');
    expect(result).toBe('정상 상태');
  });

  it('should sanitize nested object string values', () => {
    const input = { status: '正常', server: { name: '服务器-01' } };
    const result = sanitizeJsonStrings(input);
    expect(result.status).toBe('정상');
    expect(result.server.name).toContain('서버');
  });

  it('should sanitize arrays', () => {
    const input = ['正常', '异常', '警告'];
    const result = sanitizeJsonStrings(input);
    expect(result).toEqual(['정상', '이상', '경고']);
  });

  it('should pass through non-string primitives', () => {
    expect(sanitizeJsonStrings(42)).toBe(42);
    expect(sanitizeJsonStrings(true)).toBe(true);
    expect(sanitizeJsonStrings(null)).toBe(null);
  });
});
