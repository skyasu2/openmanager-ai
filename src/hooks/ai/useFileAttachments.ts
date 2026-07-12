'use client';

/**
 * useFileAttachments - 파일 첨부 관리 훅
 *
 * AI 채팅에서 파일 첨부(드래그앤드롭, 클릭 선택)를 관리합니다.
 * Vision Agent를 위한 이미지, PDF, MD 파일 지원.
 *
 * 제한사항:
 * - 최대 3개 파일
 * - 이미지: 최대 10MB
 * - PDF/MD: 최대 5MB
 *
 * @created 2026-01-27
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';

// ============================================================================
// Types
// ============================================================================

export interface FileAttachment {
  /** 고유 ID */
  id: string;
  /** 파일명 */
  name: string;
  /** MIME 타입 */
  mimeType: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** Base64 데이터 (data URL 형식 포함) */
  data: string;
  /** 파일 타입 카테고리 */
  type: 'image' | 'pdf' | 'markdown' | 'other';
  /** 미리보기 URL (이미지용) */
  previewUrl?: string;
}

export interface FileValidationError {
  file: File;
  reason: 'size' | 'type' | 'count';
  message: string;
}

export interface UseFileAttachmentsOptions {
  /** 최대 파일 개수 (기본: 3) */
  maxFiles?: number;
  /** 최대 이미지 크기 (bytes, 기본: 10MB) */
  maxImageSize?: number;
  /** 최대 문서 크기 (bytes, 기본: 5MB) */
  maxDocSize?: number;
}

export interface UseFileAttachmentsReturn {
  /** 첨부된 파일 목록 */
  attachments: FileAttachment[];
  /** 선택한 파일을 읽고 있는지 여부 */
  isProcessing: boolean;
  /** 드래그 중인지 여부 */
  isDragging: boolean;
  /** 에러 목록 */
  errors: FileValidationError[];
  /** 파일 추가 */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** 파일 제거 */
  removeFile: (id: string) => void;
  /** 모든 파일 제거 */
  clearFiles: () => void;
  /** 에러 제거 */
  clearErrors: () => void;
  /** 드래그 이벤트 핸들러 */
  dragHandlers: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  /** 파일 첨부 가능 여부 */
  canAddMore: boolean;
  /** 남은 파일 슬롯 수 */
  remainingSlots: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_FILES = 3;
const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
const DRAG_INACTIVITY_RESET_MS = 2_000;

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

// ============================================================================
// Utilities
// ============================================================================

/**
 * 파일 타입 분류
 */
function classifyFileType(
  mimeType: string,
  fileName: string
): FileAttachment['type'] {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (mimeType === 'application/pdf') {
    return 'pdf';
  }
  if (
    mimeType === 'text/markdown' ||
    mimeType === 'text/plain' ||
    fileName.endsWith('.md')
  ) {
    return 'markdown';
  }
  return 'other';
}

/**
 * 고유 ID 생성
 */
function generateId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 파일을 Base64로 변환
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// Hook
// ============================================================================

export function useFileAttachments(
  options: UseFileAttachmentsOptions = {}
): UseFileAttachmentsReturn {
  const {
    maxFiles = DEFAULT_MAX_FILES,
    maxImageSize = DEFAULT_MAX_IMAGE_SIZE,
    maxDocSize = DEFAULT_MAX_DOC_SIZE,
  } = options;

  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [pendingFileCount, setPendingFileCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<FileValidationError[]>([]);

  const attachmentsRef = useRef<FileAttachment[]>([]);
  const attachmentGenerationRef = useRef(0);
  const reservedSlotsRef = useRef(0);

  // Drag nesting is event bookkeeping, not render state.
  const dragCounterRef = useRef(0);
  const dragResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 파일 유효성 검사
   */
  const validateFile = useCallback(
    (file: File, currentCount: number): FileValidationError | null => {
      // 개수 체크
      if (currentCount >= maxFiles) {
        return {
          file,
          reason: 'count',
          message: `최대 ${maxFiles}개 파일만 첨부할 수 있습니다`,
        };
      }

      // 타입 체크
      const fileType = classifyFileType(file.type, file.name);
      if (fileType === 'other') {
        return {
          file,
          reason: 'type',
          message: `지원하지 않는 파일 형식입니다: ${file.name}`,
        };
      }

      // 크기 체크
      const maxSize = fileType === 'image' ? maxImageSize : maxDocSize;
      if (file.size > maxSize) {
        return {
          file,
          reason: 'size',
          message: `파일이 너무 큽니다: ${file.name} (${formatFileSize(file.size)} > ${formatFileSize(maxSize)})`,
        };
      }

      return null;
    },
    [maxFiles, maxImageSize, maxDocSize]
  );

  /**
   * 파일 추가
   */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newErrors: FileValidationError[] = [];
      const validFiles: File[] = [];
      const operationGeneration = attachmentGenerationRef.current;

      let currentCount =
        attachmentsRef.current.length + reservedSlotsRef.current;

      for (const file of fileArray) {
        const error = validateFile(file, currentCount);
        if (error) {
          newErrors.push(error);
        } else {
          validFiles.push(file);
          currentCount++;
        }
      }

      // 에러 업데이트
      if (newErrors.length > 0) {
        setErrors((prev) => [...prev, ...newErrors]);
      }

      // 유효한 파일 처리
      if (validFiles.length > 0) {
        reservedSlotsRef.current += validFiles.length;
        setPendingFileCount((prev) => prev + validFiles.length);
        const newAttachments: FileAttachment[] = [];
        const processingErrors: FileValidationError[] = [];

        try {
          for (const file of validFiles) {
            try {
              const data = await fileToBase64(file);
              const fileType = classifyFileType(file.type, file.name);

              newAttachments.push({
                id: generateId(),
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                data,
                type: fileType,
                previewUrl: fileType === 'image' ? data : undefined,
              });
            } catch (error) {
              logger.error('File processing error:', error);
              processingErrors.push({
                file,
                reason: 'type',
                message: `파일 처리 실패: ${file.name}`,
              });
            }
          }

          if (attachmentGenerationRef.current !== operationGeneration) {
            return;
          }

          if (processingErrors.length > 0) {
            setErrors((prev) => [...prev, ...processingErrors]);
          }

          setAttachments((prev) => {
            if (attachmentGenerationRef.current !== operationGeneration) {
              return prev;
            }
            const next = [...prev, ...newAttachments];
            attachmentsRef.current = next;
            return next;
          });
        } finally {
          if (attachmentGenerationRef.current === operationGeneration) {
            reservedSlotsRef.current = Math.max(
              0,
              reservedSlotsRef.current - validFiles.length
            );
            setPendingFileCount((prev) =>
              Math.max(0, prev - validFiles.length)
            );
          }
        }
      }
    },
    [validateFile]
  );

  /**
   * 파일 제거
   */
  const removeFile = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      // 이미지 프리뷰 URL 해제
      if (attachment?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      const next = prev.filter((a) => a.id !== id);
      attachmentsRef.current = next;
      return next;
    });
  }, []);

  /**
   * 모든 파일 제거
   */
  const clearFiles = useCallback(() => {
    attachmentGenerationRef.current += 1;
    reservedSlotsRef.current = 0;
    setPendingFileCount(0);
    attachmentsRef.current.forEach((a) => {
      if (a.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(a.previewUrl);
      }
    });
    attachmentsRef.current = [];
    setAttachments([]);
  }, []);

  /**
   * 에러 제거
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // ============================================================================
  // Drag & Drop Handlers
  // ============================================================================

  const clearDragResetTimer = useCallback(() => {
    if (dragResetTimerRef.current !== null) {
      clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
  }, []);

  const resetDragging = useCallback(() => {
    clearDragResetTimer();
    dragCounterRef.current = 0;
    setIsDragging(false);
  }, [clearDragResetTimer]);

  const scheduleDragReset = useCallback(() => {
    clearDragResetTimer();
    dragResetTimerRef.current = setTimeout(
      resetDragging,
      DRAG_INACTIVITY_RESET_MS
    );
  }, [clearDragResetTimer, resetDragging]);

  useEffect(() => {
    const handleGlobalDragEnd = () => resetDragging();

    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);
    window.addEventListener('blur', handleGlobalDragEnd);

    return () => {
      attachmentGenerationRef.current += 1;
      reservedSlotsRef.current = 0;
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
      window.removeEventListener('blur', handleGlobalDragEnd);
      clearDragResetTimer();
    };
  }, [clearDragResetTimer, resetDragging]);

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      setIsDragging(true);
      scheduleDragReset();
    },
    [scheduleDragReset]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        resetDragging();
      }
    },
    [resetDragging]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      scheduleDragReset();
    },
    [scheduleDragReset]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resetDragging();

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles, resetDragging]
  );

  // ============================================================================
  // Return
  // ============================================================================

  const occupiedSlots = attachments.length + pendingFileCount;
  const canAddMore = occupiedSlots < maxFiles;
  const remainingSlots = Math.max(0, maxFiles - occupiedSlots);

  return {
    attachments,
    isProcessing: pendingFileCount > 0,
    isDragging,
    errors,
    addFiles,
    removeFile,
    clearFiles,
    clearErrors,
    dragHandlers: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
    canAddMore,
    remainingSlots,
  };
}
