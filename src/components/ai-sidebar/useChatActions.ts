'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type FileAttachment,
  useFileAttachments,
} from '@/hooks/ai/useFileAttachments';
import { collectClipboardImageFiles } from './clipboard-image-paste';

interface UseChatActionsOptions {
  handleSendInput: (attachments?: FileAttachment[]) => void;
  isGenerating: boolean;
  isLimitReached?: boolean;
  shouldRestoreFocus?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  limitedMessagesLength: number;
}

export function useChatActions({
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
    isProcessing: isProcessingAttachments,
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
    if (isLimitReached || isProcessingAttachments) {
      return;
    }

    handleSendInput(attachments.length > 0 ? attachments : undefined);
    clearFiles();
  }, [
    attachments,
    clearFiles,
    handleSendInput,
    isLimitReached,
    isProcessingAttachments,
  ]);

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
      const imageFiles = collectClipboardImageFiles(e.clipboardData?.items);
      if (imageFiles.length === 0) {
        return;
      }

      e.preventDefault();
      void addFiles(imageFiles);
    },
    [addFiles]
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
    isProcessingAttachments,
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
