/**
 * @vitest-environment jsdom
 *
 * useFileAttachments — Base64 변환 + 메모리 정리 + DnD + 엣지케이스 테스트
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileAttachments } from './useFileAttachments';
import {
  createMockFile,
  mockRevokeObjectURL,
  setupFileMocks,
  teardownFileMocks,
} from './useFileAttachments.test-setup';

beforeEach(() => setupFileMocks());
afterEach(() => teardownFileMocks());

// ============================================================================
// Base64 Conversion Tests
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
  it('파일 제거 시 blob URL 해제', async () => {
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
// Drag & Drop Tests
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

    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

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

    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

    await act(async () => {
      result.current.dragHandlers.onDragLeave(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

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

    await act(async () => {
      result.current.dragHandlers.onDragEnter(mockEvent);
    });

    expect(result.current.isDragging).toBe(true);

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

    const file = createMockFile('unknown.abc', '', 1024);

    await act(async () => {
      await result.current.addFiles([file]);
    });

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
      expect(result.current.attachments[0].id).not.toBe(
        result.current.attachments[1].id
      );
    });
  });

  it('혼합된 유효/무효 파일 처리', async () => {
    const { result } = renderHook(() => useFileAttachments());

    const files = [
      createMockFile('valid.png', 'image/png', 1024),
      createMockFile('invalid.exe', 'application/octet-stream', 1024),
      createMockFile('valid.pdf', 'application/pdf', 1024),
      createMockFile('huge.png', 'image/png', 20 * 1024 * 1024),
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(2);
      expect(result.current.errors).toHaveLength(2);
    });
  });
});
