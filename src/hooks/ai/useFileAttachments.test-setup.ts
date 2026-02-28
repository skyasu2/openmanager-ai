/**
 * useFileAttachments 테스트 공유 setup
 *
 * Mock FileReader, URL, createMockFile helper를 제공.
 * 명시적 setupFileMocks / teardownFileMocks 호출 방식.
 */

import { vi } from 'vitest';

export const mockRevokeObjectURL = vi.fn();
const originalURL = globalThis.URL;

export function setupFileMocks() {
  vi.clearAllMocks();

  class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL(file: File) {
      setTimeout(() => {
        this.result = `data:${file.type || 'application/octet-stream'};base64,${btoa('mock-content')}`;
        this.onload?.();
      }, 0);
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);

  vi.stubGlobal('URL', {
    ...originalURL,
    createObjectURL: vi.fn(() => `blob:mock-url-${Date.now()}`),
    revokeObjectURL: mockRevokeObjectURL,
  });
}

export function teardownFileMocks() {
  vi.unstubAllGlobals();
}

/**
 * Create a mock File object
 */
export function createMockFile(name: string, type: string, size: number): File {
  const content = new Array(Math.max(1, size)).fill('x').join('');
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}
