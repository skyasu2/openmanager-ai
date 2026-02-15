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

import { useCallback, useState } from 'react';
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
  /** 드래그 중인지 여부 */
  isDragging: boolean;
  /** 에러 목록 */
  errors: FileValidationError[];
  /** 파일 추가 */
  addFiles: (files: FileList | File[]) => void;
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
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<FileValidationError[]>([]);

  // 드래그 카운터 (nested drag 처리용)
  const [, setDragCounter] = useState(0);

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

      let currentCount = attachments.length;

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
        const newAttachments: FileAttachment[] = [];
        const processingErrors: FileValidationError[] = [];

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

        // 🎯 Fix: 파일 처리 중 발생한 에러도 사용자에게 노출
        if (processingErrors.length > 0) {
          setErrors((prev) => [...prev, ...processingErrors]);
        }

        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
    [attachments.length, validateFile]
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
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  /**
   * 모든 파일 제거
   */
  const clearFiles = useCallback(() => {
    attachments.forEach((a) => {
      if (a.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(a.previewUrl);
      }
    });
    setAttachments([]);
  }, [attachments]);

  /**
   * 에러 제거
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // ============================================================================
  // Drag & Drop Handlers
  // ============================================================================

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles]
  );

  // ============================================================================
  // Return
  // ============================================================================

  const canAddMore = attachments.length < maxFiles;
  const remainingSlots = maxFiles - attachments.length;

  return {
    attachments,
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

export default useFileAttachments;
