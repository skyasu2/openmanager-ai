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

describe('formatFileSize()', () => {
  it('should format bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0B');
    expect(formatFileSize(512)).toBe('512B');
    expect(formatFileSize(1023)).toBe('1023B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0KB');
    expect(formatFileSize(1536)).toBe('1.5KB');
    expect(formatFileSize(10240)).toBe('10.0KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0MB');
    expect(formatFileSize(10.5 * 1024 * 1024)).toBe('10.5MB');
  });
});

// ============================================================================
// File Type Classification Tests
// ============================================================================

describe('useFileAttachments - 파일 타입 분류', () => {
  it('이미지 MIME 타입을 image로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const imageFile = createMockFile('test.png', 'image/png', 1024);

    await act(async () => {
      await result.current.addFiles([imageFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('image');
    });
  });

  it('image/jpeg를 image로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const jpegFile = createMockFile('photo.jpg', 'image/jpeg', 1024);

    await act(async () => {
      await result.current.addFiles([jpegFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('image');
    });
  });

  it('image/gif를 image로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const gifFile = createMockFile('animation.gif', 'image/gif', 1024);

    await act(async () => {
      await result.current.addFiles([gifFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('image');
    });
  });

  it('image/webp를 image로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const webpFile = createMockFile('modern.webp', 'image/webp', 1024);

    await act(async () => {
      await result.current.addFiles([webpFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('image');
    });
  });

  it('PDF를 pdf로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const pdfFile = createMockFile('document.pdf', 'application/pdf', 1024);

    await act(async () => {
      await result.current.addFiles([pdfFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('pdf');
    });
  });

  it('text/markdown을 markdown으로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const mdFile = createMockFile('readme.md', 'text/markdown', 1024);

    await act(async () => {
      await result.current.addFiles([mdFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('markdown');
    });
  });

  it('.md 확장자를 markdown으로 분류 (MIME 타입 불명확한 경우)', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // text/plain MIME 타입이지만 .md 확장자
    const mdFile = createMockFile('notes.md', 'text/plain', 1024);

    await act(async () => {
      await result.current.addFiles([mdFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('markdown');
    });
  });

  it('text/plain을 markdown으로 분류', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const txtFile = createMockFile('log.txt', 'text/plain', 1024);

    await act(async () => {
      await result.current.addFiles([txtFile]);
    });

    await waitFor(() => {
      expect(result.current.attachments[0].type).toBe('markdown');
    });
  });

  it('지원하지 않는 타입을 other로 분류하고 에러 발생', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const exeFile = createMockFile('app.exe', 'application/octet-stream', 1024);

    await act(async () => {
      await result.current.addFiles([exeFile]);
    });

    // 지원하지 않는 타입은 첨부되지 않음
    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].reason).toBe('type');
    expect(result.current.errors[0].message).toContain(
      '지원하지 않는 파일 형식'
    );
  });
});

// ============================================================================
// File Size Validation Tests
// ============================================================================

describe('useFileAttachments - 파일 크기 검증', () => {
  it('10MB 초과 이미지 거부', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // 11MB 이미지
    const largeImage = createMockFile(
      'huge.png',
      'image/png',
      11 * 1024 * 1024
    );

    await act(async () => {
      await result.current.addFiles([largeImage]);
    });

    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].reason).toBe('size');
    expect(result.current.errors[0].message).toContain('파일이 너무 큽니다');
  });

  it('5MB 초과 문서 거부', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // 6MB PDF
    const largePdf = createMockFile(
      'large.pdf',
      'application/pdf',
      6 * 1024 * 1024
    );

    await act(async () => {
      await result.current.addFiles([largePdf]);
    });

    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].reason).toBe('size');
  });

  it('제한 내 이미지 파일 허용 (10MB)', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // 정확히 10MB
    const maxImage = createMockFile('max.png', 'image/png', 10 * 1024 * 1024);

    await act(async () => {
      await result.current.addFiles([maxImage]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.errors).toHaveLength(0);
    });
  });

  it('제한 내 문서 파일 허용 (5MB)', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // 정확히 5MB
    const maxDoc = createMockFile(
      'max.pdf',
      'application/pdf',
      5 * 1024 * 1024
    );

    await act(async () => {
      await result.current.addFiles([maxDoc]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.errors).toHaveLength(0);
    });
  });

  it('커스텀 크기 제한 적용', async () => {
    const { result } = renderHook(() =>
      useFileAttachments({
        maxImageSize: 1 * 1024 * 1024, // 1MB
        maxDocSize: 512 * 1024, // 512KB
      })
    );

    // 2MB 이미지 - 거부되어야 함
    const image = createMockFile('test.png', 'image/png', 2 * 1024 * 1024);

    await act(async () => {
      await result.current.addFiles([image]);
    });

    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors[0].reason).toBe('size');
  });
});

// ============================================================================
// File Count Limit Tests
// ============================================================================

describe('useFileAttachments - 파일 개수 제한', () => {
  it('3개 초과 파일 거부', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const files = [
      createMockFile('img1.png', 'image/png', 1024),
      createMockFile('img2.png', 'image/png', 1024),
      createMockFile('img3.png', 'image/png', 1024),
      createMockFile('img4.png', 'image/png', 1024), // 이것은 거부됨
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(3);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].reason).toBe('count');
    });
  });

  it('에러 메시지에 제한 표시', async () => {
    const { result } = renderHook(() => useFileAttachments({ maxFiles: 2 }));

    const files = [
      createMockFile('img1.png', 'image/png', 1024),
      createMockFile('img2.png', 'image/png', 1024),
      createMockFile('img3.png', 'image/png', 1024),
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.errors[0].message).toContain('최대 2개');
    });
  });

  it('커스텀 개수 제한 적용', async () => {
    const { result } = renderHook(() => useFileAttachments({ maxFiles: 5 }));

    const files = Array.from({ length: 6 }, (_, i) =>
      createMockFile(`img${i}.png`, 'image/png', 1024)
    );

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(5);
      expect(result.current.errors).toHaveLength(1);
    });
  });

  it('canAddMore가 개수 제한에 따라 업데이트', async () => {
    const { result } = renderHook(() => useFileAttachments({ maxFiles: 2 }));

    expect(result.current.canAddMore).toBe(true);
    expect(result.current.remainingSlots).toBe(2);

    await act(async () => {
      await result.current.addFiles([
        createMockFile('img1.png', 'image/png', 1024),
      ]);
    });

    await waitFor(() => {
      expect(result.current.canAddMore).toBe(true);
      expect(result.current.remainingSlots).toBe(1);
    });

    await act(async () => {
      await result.current.addFiles([
        createMockFile('img2.png', 'image/png', 1024),
      ]);
    });

    await waitFor(() => {
      expect(result.current.canAddMore).toBe(false);
      expect(result.current.remainingSlots).toBe(0);
    });
  });
});

// ============================================================================
// Base64 Conversion Tests
// ============================================================================

