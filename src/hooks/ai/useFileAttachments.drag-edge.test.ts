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

describe('useFileAttachments - 드래그 앤 드롭', () => {
  it('onDragEnter 시 isDragging true', async () => {
    const { result } = renderHook(() => useFileAttachments());

    expect(result.current.isDragging).toBe(false);

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.DragEvent;

    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('onDragLeave 시 isDragging false (카운터 0일 때)', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.DragEvent;

    // Enter first
    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // Leave
    await act(async () => {
      result.current.dragHandlers.onDragLeave(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('nested drag 처리 (여러 번 enter/leave)', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.DragEvent;

    // Enter twice (nested elements)
    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // Leave once - should still be dragging
    await act(async () => {
      result.current.dragHandlers.onDragLeave(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // Leave again - now should be false
    await act(async () => {
      result.current.dragHandlers.onDragLeave(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('onDrop 시 파일 추가 및 isDragging false', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const mockFile = createMockFile('dropped.png', 'image/png', 1024);
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        files: [mockFile] as unknown as FileList,
      },
    } as unknown as React.DragEvent;

    // Set dragging state first
    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // Drop
    await act(async () => {
      result.current.dragHandlers.onDrop(mockEvent);
    });

    expect(result.current.isDragging).toBe(false);

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('dropped.png');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('useFileAttachments - 엣지 케이스', () => {
  it('빈 FileList 처리', async () => {
    const { result } = renderHook(() => useFileAttachments());

    await act(async () => {
      await result.current.addFiles([]);
    });

    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors).toHaveLength(0);
  });

  it('MIME 타입 없는 파일 처리', async () => {
    const { result } = renderHook(() => useFileAttachments());

    // MIME 타입이 빈 문자열인 파일
    const file = createMockFile('unknown.abc', '', 1024);

    await act(async () => {
      await result.current.addFiles([file]);
    });

    // 지원하지 않는 타입으로 처리
    expect(result.current.attachments).toHaveLength(0);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0].reason).toBe('type');
  });

  it('동일 파일 여러 번 추가 가능', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const file = createMockFile('same.png', 'image/png', 1024);

    await act(async () => {
      await result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(1);
    });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(2);
      // 각각 고유 ID를 가짐
      expect(result.current.attachments[0].id).not.toBe(
        result.current.attachments[1].id
      );
    });
  });

  it('혼합된 유효/무효 파일 처리', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const files = [
      createMockFile('valid.png', 'image/png', 1024), // 유효
      createMockFile('invalid.exe', 'application/octet-stream', 1024), // 무효 (타입)
      createMockFile('valid.pdf', 'application/pdf', 1024), // 유효
      createMockFile('huge.png', 'image/png', 20 * 1024 * 1024), // 무효 (크기)
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(2); // 유효한 파일만
      expect(result.current.errors).toHaveLength(2); // 무효한 파일
    });
  });
});
