/**
 * useFileAttachments Hook Tests
 *
 * AI 채팅 파일 첨부 기능의 핵심 로직 테스트
 * - 파일 타입 분류
 * - 크기/개수 검증
 * - Base64 변환
 * - 메모리 정리
 *
 * @created 2026-01-27
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatFileSize, useFileAttachments } from './useFileAttachments';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock URL methods
const mockRevokeObjectURL = vi.fn();
const originalURL = globalThis.URL;

beforeEach(() => {
  vi.clearAllMocks();

  // Setup FileReader mock as a proper class
  class MockFileReader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    readAsDataURL(file: File) {
      // Simulate async read
      setTimeout(() => {
        this.result = `data:${file.type || 'application/octet-stream'};base64,${btoa('mock-content')}`;
        this.onload?.();
      }, 0);
    }
  }

  vi.stubGlobal('FileReader', MockFileReader);

  // Setup URL mocks while preserving other URL functionality
  vi.stubGlobal('URL', {
    ...originalURL,
    createObjectURL: vi.fn(() => `blob:mock-url-${Date.now()}`),
    revokeObjectURL: mockRevokeObjectURL,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock File object
 */
function createMockFile(name: string, type: string, size: number): File {
  // Create a blob with approximate size
  const content = new Array(Math.max(1, size)).fill('x').join('');
  const blob = new Blob([content], { type });

  // Create File from Blob
  return new File([blob], name, { type });
}

// ============================================================================
// formatFileSize Tests
// ============================================================================

describe('useFileAttachments - Base64 변환', () => {
  it('파일을 data URL로 변환', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const file = createMockFile('test.png', 'image/png', 1024);

    await act(async () => {
      await result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].data).toMatch(
        /^data:image\/png;base64,/
      );
    });
  });

  it('이미지에 previewUrl 생성', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const imageFile = createMockFile('preview.png', 'image/png', 1024);

    await act(async () => {
      await result.current.addFiles([imageFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].previewUrl).toBeDefined();
      // previewUrl은 data URL과 동일 (이미지의 경우)
      expect(result.current.attachments[0].previewUrl).toBe(
        result.current.attachments[0].data
      );
    });
  });

  it('PDF에는 previewUrl 없음', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const pdfFile = createMockFile('doc.pdf', 'application/pdf', 1024);

    await act(async () => {
      await result.current.addFiles([pdfFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].previewUrl).toBeUndefined();
    });
  });

  it('attachment에 올바른 메타데이터 포함', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const file = createMockFile('example.png', 'image/png', 2048);

    await act(async () => {
      await result.current.addFiles([file]);
    });

    await waitFor(() => {
      const attachment = result.current.attachments[0];
      expect(attachment.name).toBe('example.png');
      expect(attachment.mimeType).toBe('image/png');
      expect(attachment.size).toBe(2048);
      expect(attachment.id).toMatch(/^file_\d+_[a-z0-9]+$/);
    });
  });
});

// ============================================================================
// Memory Cleanup Tests
// ============================================================================

describe('useFileAttachments - 메모리 정리', () => {
  it('파일 제거 시 blob URL 해제 (blob: prefix)', async () => {
    // blob: URL을 반환하는 FileReader mock
    class BlobFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(_file: File) {
        setTimeout(() => {
          this.result = 'blob:mock-blob-url-12345';
          this.onload?.();
        }, 0);
      }
    }
    vi.stubGlobal('FileReader', BlobFileReader);

    const { result } = renderHook(() => useFileAttachments());

    const file = createMockFile('test.png', 'image/png', 1024);

    await act(async () => {
      await result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
    });

    const attachmentId = result.current.attachments[0].id;

    await act(async () => {
      result.current.removeFile(attachmentId);
    });

    expect(result.current.attachments).toHaveLength(0);
    // blob URL인 경우 revokeObjectURL 호출됨
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('clearFiles 시 모든 파일 제거', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const files = [
      createMockFile('img1.png', 'image/png', 1024),
      createMockFile('img2.png', 'image/png', 1024),
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(2);
    });

    await act(async () => {
      result.current.clearFiles();
    });

    expect(result.current.attachments).toHaveLength(0);
  });

  it('clearErrors 시 에러 목록 초기화', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // 지원하지 않는 파일로 에러 생성
    const invalidFile = createMockFile(
      'app.exe',
      'application/octet-stream',
      1024
    );

    await act(async () => {
      await result.current.addFiles([invalidFile]);
    });

    expect(result.current.errors).toHaveLength(1);

    await act(async () => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toHaveLength(0);
  });
});

// ============================================================================
// Drag & Drop Handler Tests
// ============================================================================
