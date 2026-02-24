'use client';

import {
  AlertCircle,
  File,
  FileText,
  Globe,
  Image as ImageIcon,
  Paperclip,
  Send,
  Square,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import React, { memo, type RefObject } from 'react';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { ImagePreviewModal } from '@/components/ui/ImagePreviewModal';
import type { FileAttachment } from '@/hooks/ai/useFileAttachments';
import { formatFileSize } from '@/hooks/ai/useFileAttachments';
import type { SessionState } from '@/types/session';

interface ChatInputAreaProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  setInputValue: (value: string) => void;
  isGenerating: boolean;
  sessionState?: SessionState;
  attachments: FileAttachment[];
  isDragging: boolean;
  fileErrors: Array<{ message: string }>;
  canAddMore: boolean;
  previewImage: { url: string; name: string } | null;
  dragHandlers: Record<string, React.DragEventHandler>;
  onSendWithAttachments: () => void;
  onOpenFileDialog: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageClick: (file: FileAttachment) => void;
  onClosePreviewModal: () => void;
  onRemoveFile: (id: string) => void;
  onClearFileErrors: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onStopGeneration?: () => void;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
}

export const ChatInputArea = memo(function ChatInputArea({
  textareaRef,
  fileInputRef,
  inputValue,
  setInputValue,
  isGenerating,
  sessionState,
  attachments,
  isDragging,
  fileErrors,
  canAddMore,
  previewImage,
  dragHandlers,
  onSendWithAttachments,
  onOpenFileDialog,
  onFileSelect,
  onImageClick,
  onClosePreviewModal,
  onRemoveFile,
  onClearFileErrors,
  onPaste,
  onStopGeneration,
  webSearchEnabled,
  onToggleWebSearch,
}: ChatInputAreaProps) {
  return (
    <>
      <div
        className="relative shrink-0 border-t border-gray-200 bg-white/80 backdrop-blur-sm"
        {...dragHandlers}
      >
        {/* 드래그앤드롭 오버레이 */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/90">
            <div className="flex flex-col items-center gap-2 text-blue-600">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">파일을 여기에 놓으세요</p>
              <p className="text-xs text-blue-500">
                이미지, PDF, MD (최대 3개)
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 py-4">
          {/* 파일 에러 토스트 */}
          {fileErrors.length > 0 && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div className="space-y-1">
                    {fileErrors.map((err, idx) => (
                      <p key={idx} className="text-xs text-red-600">
                        {err.message}
                      </p>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClearFileErrors}
                  className="text-red-400 hover:text-red-600"
                  aria-label="파일 에러 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* 파일 미리보기 칩 */}
          {attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  {file.type === 'image' ? (
                    file.previewUrl ? (
                      <button
                        type="button"
                        onClick={() => onImageClick(file)}
                        className="shrink-0 cursor-pointer overflow-hidden rounded transition-opacity hover:opacity-80"
                        title="클릭하여 확대"
                        aria-label={`이미지 확대: ${file.name}`}
                      >
                        <Image
                          src={file.previewUrl}
                          alt={file.name}
                          width={32}
                          height={32}
                          className="rounded object-cover"
                          unoptimized
                        />
                      </button>
                    ) : (
                      <ImageIcon className="h-5 w-5 text-blue-500" />
                    )
                  ) : file.type === 'pdf' ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : (
                    <File className="h-5 w-5 text-gray-500" />
                  )}
                  <div className="max-w-[120px]">
                    <p className="truncate text-xs font-medium text-gray-700">
                      {file.name}
                    </p>
                    <p className="text-2xs text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label={`${file.name} 첨부 제거`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 메인 입력 컨테이너 */}
          <div
            className="relative flex items-end rounded-2xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
            onPaste={onPaste}
          >
            {/* 웹 검색 토글 + 파일 첨부 버튼 */}
            <div className="flex items-center pl-2">
              {onToggleWebSearch && (
                <button
                  type="button"
                  onClick={onToggleWebSearch}
                  disabled={sessionState?.isLimitReached}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    webSearchEnabled
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  title={webSearchEnabled ? '웹 검색 끄기' : '웹 검색 켜기'}
                  aria-label="웹 검색 토글"
                  aria-pressed={webSearchEnabled}
                >
                  <Globe className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={onOpenFileDialog}
                disabled={!canAddMore || sessionState?.isLimitReached}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  canAddMore ? '파일 첨부 (이미지, PDF, MD)' : '최대 3개 파일'
                }
                aria-label="파일 첨부"
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            <AutoResizeTextarea
              ref={textareaRef}
              value={inputValue}
              onValueChange={setInputValue}
              onKeyboardShortcut={onSendWithAttachments}
              placeholder={
                sessionState?.isLimitReached
                  ? '새 대화를 시작해주세요'
                  : isGenerating
                    ? '📝 대답 중에도 편하게 입력하세요 (대기열에 추가됨)'
                    : attachments.length > 0
                      ? '이미지/파일과 함께 질문하세요...'
                      : '메시지를 입력하세요...'
              }
              className="flex-1 resize-none border-none bg-transparent px-2 py-3 pr-14 text-chat text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-0"
              minHeight={48}
              maxHeight={200}
              maxHeightVh={30}
              aria-label="AI 질문 입력"
              disabled={sessionState?.isLimitReached}
            />

            {/* 전송/중단 버튼 */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              {isGenerating && onStopGeneration && (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm transition-all hover:bg-red-600"
                  title="생성 중단"
                  aria-label="생성 중단"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              )}
              <button
                type="button"
                onClick={onSendWithAttachments}
                disabled={
                  (!inputValue.trim() && attachments.length === 0) ||
                  sessionState?.isLimitReached
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                title={isGenerating ? '대기열에 추가' : '메시지 전송'}
                aria-label={isGenerating ? '대기열에 추가' : '메시지 전송'}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.md,text/markdown,text/plain"
            multiple
            onChange={onFileSelect}
            className="hidden"
            tabIndex={-1}
          />

          {/* 하단 힌트 */}
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              {sessionState && !sessionState.isWarning && (
                <span>대화 {sessionState.count}/20</span>
              )}
              {attachments.length > 0 && (
                <span className="text-blue-500">
                  📎 {attachments.length}/3 파일
                </span>
              )}
            </div>
            <span>Enter로 전송, Shift+Enter로 줄바꿈</span>
          </div>
        </div>
      </div>

      {/* 이미지 확대 미리보기 모달 */}
      {previewImage && (
        <ImagePreviewModal
          isOpen={!!previewImage}
          onClose={onClosePreviewModal}
          imageUrl={previewImage.url}
          imageName={previewImage.name}
        />
      )}
    </>
  );
});
