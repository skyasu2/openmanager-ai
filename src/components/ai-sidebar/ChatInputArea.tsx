'use client';

import {
  AlertCircle,
  BookOpen,
  File,
  FileText,
  Globe,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Send,
  Square,
  Upload,
  X,
} from 'lucide-react';
import Image from 'next/image';
import React, {
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  ragEnabled?: boolean;
  onToggleRAG?: () => void;
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
  ragEnabled,
  onToggleRAG,
}: ChatInputAreaProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // 활성화된 도구 수 (badge 표시용)
  const activeToolCount = (webSearchEnabled ? 1 : 0) + (ragEnabled ? 1 : 0);

  // 외부 클릭 시 popover 닫기
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(e.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopoverOpen]);

  const handleTogglePopover = useCallback(() => {
    setIsPopoverOpen((prev) => !prev);
  }, []);

  const handleFileAttach = useCallback(() => {
    onOpenFileDialog();
    setIsPopoverOpen(false);
  }, [onOpenFileDialog]);

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

          {/* 활성 도구 뱃지 (popover 밖에 표시) */}
          {activeToolCount > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ragEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                  <BookOpen className="h-3 w-3" />
                  RAG
                </span>
              )}
              {webSearchEnabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  <Globe className="h-3 w-3" />
                  Web
                </span>
              )}
            </div>
          )}

          {/* 메인 입력 컨테이너 */}
          <div
            className="relative flex items-end rounded-2xl border border-gray-200 bg-white shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
            onPaste={onPaste}
          >
            {/* + 버튼 (도구 popover 트리거) */}
            <div className="relative flex items-center pl-2">
              <button
                ref={toggleButtonRef}
                type="button"
                onClick={handleTogglePopover}
                disabled={sessionState?.isLimitReached}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  isPopoverOpen || activeToolCount > 0
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title="도구 및 옵션"
                aria-label="도구 메뉴 열기"
                aria-expanded={isPopoverOpen}
              >
                <Plus
                  className={`h-5 w-5 transition-transform duration-200 ${isPopoverOpen ? 'rotate-45' : ''}`}
                />
              </button>

              {/* Popover */}
              {isPopoverOpen && (
                <div
                  ref={popoverRef}
                  className="absolute bottom-12 left-0 z-50 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
                >
                  {/* RAG 토글 */}
                  {onToggleRAG && (
                    <button
                      type="button"
                      onClick={onToggleRAG}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        ragEnabled
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <BookOpen
                        className={`h-4 w-4 ${ragEnabled ? 'text-purple-500' : 'text-gray-400'}`}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">RAG 검색</div>
                        <div className="text-xs text-gray-500">
                          과거 장애 이력 검색
                        </div>
                      </div>
                      <div
                        className={`h-4 w-7 rounded-full transition-colors ${ragEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${ragEnabled ? 'translate-x-3' : 'translate-x-0'}`}
                        />
                      </div>
                    </button>
                  )}

                  {/* 웹 검색 토글 */}
                  {onToggleWebSearch && (
                    <button
                      type="button"
                      onClick={onToggleWebSearch}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        webSearchEnabled
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Globe
                        className={`h-4 w-4 ${webSearchEnabled ? 'text-blue-500' : 'text-gray-400'}`}
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium">Web 검색</div>
                        <div className="text-xs text-gray-500">
                          최신 정보 웹 검색
                        </div>
                      </div>
                      <div
                        className={`h-4 w-7 rounded-full transition-colors ${webSearchEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${webSearchEnabled ? 'translate-x-3' : 'translate-x-0'}`}
                        />
                      </div>
                    </button>
                  )}

                  {/* 구분선 */}
                  <div className="my-1 border-t border-gray-100" />

                  {/* 파일 첨부 */}
                  <button
                    type="button"
                    onClick={handleFileAttach}
                    disabled={!canAddMore || sessionState?.isLimitReached}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Paperclip className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="font-medium">파일 첨부</div>
                      <div className="text-xs text-gray-500">
                        이미지, PDF, MD ({attachments.length}/3)
                      </div>
                    </div>
                  </button>
                </div>
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
                    ? '대답 중에도 편하게 입력하세요 (대기열에 추가됨)'
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
                  {attachments.length}/3 파일
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
