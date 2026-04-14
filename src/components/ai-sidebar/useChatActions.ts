'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type FileAttachment,
  useFileAttachments,
} from '@/hooks/ai/useFileAttachments';

interface UseChatActionsOptions {
  setInputValue: (value: string) => void;
  handleSendInput: (attachments?: FileAttachment[]) => void;
  isGenerating: boolean;
  isLimitReached?: boolean;
  shouldRestoreFocus?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  limitedMessagesLength: number;
}

export function useChatActions({
  setInputValue,
  handleSendInput,
  isGenerating,
  isLimitReached,
  shouldRestoreFocus = true,
  messagesEndRef,
  limitedMessagesLength,
}: UseChatActionsOptions) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(limitedMessagesLength);

  const {
    attachments,
    isDragging,
    errors: fileErrors,
    addFiles,
    removeFile,
    clearFiles,
    clearErrors: clearFileErrors,
    dragHandlers,
    canAddMore,
  } = useFileAttachments({ maxFiles: 3 });

  const [previewImage, setPreviewImage] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const handleSendWithAttachments = useCallback(() => {
    if (isGenerating || isLimitReached) {
      return;
    }

    handleSendInput(attachments.length > 0 ? attachments : undefined);
    clearFiles();
  }, [attachments, clearFiles, handleSendInput, isGenerating, isLimitReached]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
      e.target.value = '';
    },
    [addFiles]
  );

  const handleImageClick = useCallback((file: FileAttachment) => {
    if (file.type === 'image' && file.previewUrl) {
      setPreviewImage({ url: file.previewUrl, name: file.name });
    }
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = item.type.split('/')[1] || 'png';
            Object.defineProperty(file, 'name', {
              writable: true,
              value: `clipboard-${timestamp}.${extension}`,
            });
            imageFiles.push(file);
          }
        } else if (item.type === 'text/plain') {
          item.getAsString((text) => {
            if (text?.trim() && imageFiles.length > 0) {
              setInputValue(text);
            }
          });
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles, setInputValue]
  );

  // Auto-scroll on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: limitedMessagesLength is intentional trigger
  useEffect(() => {
    const container = scrollContainerRef.current;
    const endElement = messagesEndRef?.current;

    if (!container || !endElement) return;

    const hasNewMessages =
      limitedMessagesLength > previousMessageCountRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    if (hasNewMessages || isNearBottom) {
      requestAnimationFrame(() => {
        endElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }

    previousMessageCountRef.current = limitedMessagesLength;
  }, [limitedMessagesLength, isGenerating, messagesEndRef]);

  // Focus textarea after generation completes
  useEffect(() => {
    if (!isGenerating && !isLimitReached && shouldRestoreFocus) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isGenerating, isLimitReached, shouldRestoreFocus]);

  return {
    scrollContainerRef,
    textareaRef,
    fileInputRef,
    attachments,
    isDragging,
    fileErrors,
    removeFile,
    clearFileErrors,
    dragHandlers,
    canAddMore,
    previewImage,
    handleSendWithAttachments,
    openFileDialog,
    handleFileSelect,
    handleImageClick,
    closePreviewModal,
    handlePaste,
  };
}
