/**
 * PyodideService Unit Tests
 *
 * 브라우저 전용 서비스의 상태 관리 및 에러 처리를 테스트.
 * Pyodide WASM 런타임은 node에서 불가하므로 초기화 전 에러 경로 + 상태 메서드 중심.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Re-import fresh instance per test by using dynamic import pattern
// But since pyodideService is a singleton, we test its state transitions

import { pyodideService } from './pyodide-service';

describe('PyodideService', () => {
  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(pyodideService.isReady()).toBe(false);
    });
  });

  describe('isLoadingPyodide', () => {
    it('should return false when not loading', () => {
      expect(pyodideService.isLoadingPyodide()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should throw in non-browser environment', async () => {
      await expect(pyodideService.initialize()).rejects.toThrow(
        '브라우저 환경에서만 실행 가능'
      );
    });
  });

  describe('execute', () => {
    it('should throw when not initialized', async () => {
      await expect(pyodideService.execute('print("hello")')).rejects.toThrow(
        'Pyodide가 초기화되지 않았습니다'
      );
    });
  });

  describe('loadPackages', () => {
    it('should throw when not initialized', async () => {
      await expect(pyodideService.loadPackages(['numpy'])).rejects.toThrow(
        'Pyodide가 초기화되지 않았습니다'
      );
    });
  });

  describe('writeFile', () => {
    it('should throw when not initialized', () => {
      expect(() => pyodideService.writeFile('/tmp/test.txt', 'hello')).toThrow(
        'Pyodide가 초기화되지 않았습니다'
      );
    });
  });

  describe('readFile', () => {
    it('should throw when not initialized', () => {
      expect(() => pyodideService.readFile('/tmp/test.txt')).toThrow(
        'Pyodide가 초기화되지 않았습니다'
      );
    });
  });
});
