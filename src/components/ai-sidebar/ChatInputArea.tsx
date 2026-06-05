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
import React, { memo, type RefObject, useCallback } from 'react';
import { AutoResizeTextarea } from '@/components/ui/AutoResizeTextarea';
import { ImagePreviewModal } from '@/components/ui/ImagePreviewModal';
import type { FileAttachment } from '@/hooks/ai/useFileAttachments';
import { formatFileSize } from '@/hooks/ai/useFileAttachments';
import type { AIStreamStatus } from '@/hooks/ai/useHybridAIQuery';
import { SESSION_LIMITS, type SessionState } from '@/types/session';

const CHAT_INPUT_MAX_LENGTH = 10_000;
const CHAT_INPUT_WARNING_LENGTH = 8_000;
const CHAT_INPUT_COUNT_FORMATTER = new Intl.NumberFormat('en-US');

function formatChatInputCount(value: number): string {
  return CHAT_INPUT_COUNT_FORMATTER.format(value);
}

interface ChatInputAreaProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  setInputValue: (value: string) => void;
  isGenerating: boolean;
  streamStatus?: AIStreamStatus;
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
  streamStatus,
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
  const sessionCount = sessionState?.count ?? 0;
  const showSessionWarning =
    Boolean(sessionState?.isWarning) && !sessionState?.isLimitReached;
  const showSessionHint =
    Boolean(sessionState?.isWarning) || Boolean(sessionState?.isLimitReached);
  const inputLength = inputValue.length;
  const showInputLengthWarning = inputLength >= CHAT_INPUT_WARNING_LENGTH;
  const isInputAtHardCap = inputLength >= CHAT_INPUT_MAX_LENGTH;
  const inputLengthLabel = `입력 ${formatChatInputCount(inputLength)}/${formatChatInputCount(CHAT_INPUT_MAX_LENGTH)}자`;
  const sendButtonLabel = isGenerating ? '대기열에 추가' : '메시지 전송';

  const handleFileAttach = useCallback(() => {
    onOpenFileDialog();
  }, [onOpenFileDialog]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSendWithAttachments();
    },
    [onSendWithAttachments]
  );

  return (
    <>
      <div
        className="relative shrink-0 border-t border-purple-100 bg-white"
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
                      <p
                        key={`${idx}-${err.message}`}
                        className="text-xs text-red-600"
                      >
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
                    <p className="text-xs text-gray-400">
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
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end rounded-2xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
            onPaste={onPaste}
            aria-label="AI 질문 전송"
          >
            {/* 직접 노출되는 입력 도구 */}
            <div className="relative flex items-end gap-1 pb-1.5 pl-2">
              <button
                type="button"
                onClick={handleFileAttach}
                disabled={!canAddMore || sessionState?.isLimitReached}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
                title="파일 첨부"
                aria-label="파일 첨부"
              >
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </button>

              {onToggleWebSearch && (
                <button
                  type="button"
                  onClick={onToggleWebSearch}
                  disabled={sessionState?.isLimitReached}
                  aria-label="Web 검색"
                  aria-pressed={Boolean(webSearchEnabled)}
                  className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${
                    webSearchEnabled
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                  title="Web 검색"
                >
                  <Globe className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
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
                    ? streamStatus === 'submitted'
                      ? '요청 전송 중입니다... 잠시만 기다려주세요'
                      : '대답 중에도 편하게 입력하세요 (대기열에 추가됨)'
                    : attachments.length > 0
                      ? '이미지/파일 분석 (시각·문서 분석) — 질문을 입력하세요'
                      : '서버 운영 질문을 입력하세요'
              }
              className="flex-1 resize-none border-none bg-transparent px-2 py-3 text-chat text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:ring-0"
              minHeight={48}
              maxHeight={200}
              maxHeightVh={30}
              maxLength={CHAT_INPUT_MAX_LENGTH}
              id="ai-chat-input"
              name="ai-chat-input"
              aria-label="AI 질문 입력"
              disabled={sessionState?.isLimitReached}
            />

            {/* 전송/중단 버튼 */}
            <div className="flex shrink-0 items-end gap-1 pb-1.5 pr-2">
              {isGenerating && onStopGeneration && (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm transition-all hover:bg-red-600 md:h-9 md:w-9"
                  title="생성 중단"
                  aria-label="생성 중단"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              )}
              <button
                type="submit"
                disabled={
                  (!inputValue.trim() && attachments.length === 0) ||
                  sessionState?.isLimitReached
                }
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
                title={sendButtonLabel}
                aria-label={sendButtonLabel}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>

          {sessionState?.isLimitReached && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              새 대화를 시작하면 계속 이용할 수 있습니다
            </div>
          )}

          {/* 숨겨진 파일 입력 */}
          <input
            ref={fileInputRef}
            id="ai-chat-attachments"
            name="ai-chat-attachments"
            type="file"
            accept="image/*,.pdf,.md,text/markdown,text/plain"
            multiple
            onChange={onFileSelect}
            className="hidden"
            tabIndex={-1}
          />

          {/* 하단 힌트 */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-gray-400">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {sessionState && showSessionHint && (
                <span
                  className={
                    sessionState.isLimitReached
                      ? 'font-medium text-red-700'
                      : showSessionWarning
                        ? 'font-medium text-amber-700'
                        : undefined
                  }
                  title={
                    showSessionWarning
                      ? '곧 한도 도달'
                      : sessionState.isLimitReached
                        ? '대화 한도 도달'
                        : undefined
                  }
                >
                  대화 {sessionCount}/{SESSION_LIMITS.MESSAGE_LIMIT}
                </span>
              )}
              {showInputLengthWarning && (
                <span
                  className={`font-medium ${
                    isInputAtHardCap ? 'text-red-700' : 'text-amber-700'
                  }`}
                  title={
                    isInputAtHardCap
                      ? '입력 길이 한도 도달'
                      : '긴 입력은 답변 품질과 처리 시간에 영향을 줄 수 있습니다'
                  }
                >
                  {inputLengthLabel}
                </span>
              )}
              {showSessionWarning && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                  곧 한도 도달
                </span>
              )}
              {isInputAtHardCap && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
                  최대 입력 길이에 도달했습니다
                </span>
              )}
            </div>
            <span className="shrink-0">Shift+Enter로 줄바꿈</span>
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
