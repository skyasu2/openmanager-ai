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
import type { AIStreamStatus } from '@/hooks/ai/useHybridAIQuery';
import {
  ANALYSIS_MODE_LABELS,
  type AnalysisMode,
} from '@/types/ai/analysis-mode';
import type { SessionState } from '@/types/session';

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
  ragEnabled?: boolean;
  onToggleRAG?: () => void;
  analysisMode?: AnalysisMode;
  onSelectAnalysisMode?: (mode: AnalysisMode) => void;
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
  ragEnabled,
  onToggleRAG,
  analysisMode = 'auto',
  onSelectAnalysisMode,
}: ChatInputAreaProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  const closePopover = useCallback((restoreFocus: boolean = false) => {
    setIsPopoverOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        toggleButtonRef.current?.focus();
      });
    }
  }, []);

  // 활성화된 도구 수 (badge 표시용)
  const activeToolCount = (webSearchEnabled ? 1 : 0) + (ragEnabled ? 1 : 0);
  const showAnalysisModeBadge = analysisMode !== 'auto';

  // 외부 클릭 시 popover 닫기
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover(true);
      }
    };

    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closePopover, isPopoverOpen]);

  const handleTogglePopover = useCallback(() => {
    setIsPopoverOpen((prev) => !prev);
  }, []);

  const handleFileAttach = useCallback(() => {
    onOpenFileDialog();
    closePopover();
  }, [closePopover, onOpenFileDialog]);

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

          {/* 활성 도구 뱃지 (popover 밖에 표시) */}
          {(activeToolCount > 0 || showAnalysisModeBadge) && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {ragEnabled && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
                  title="RAG 검색을 항상 허용합니다. 실제 사용 여부는 답변 근거에서 확인하세요."
                >
                  <BookOpen className="h-3 w-3" />
                  RAG On
                </span>
              )}
              {webSearchEnabled && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  title="Web 검색을 항상 허용합니다. 실제 사용 여부는 답변 근거에서 확인하세요."
                >
                  <Globe className="h-3 w-3" />
                  Web On
                </span>
              )}
              {showAnalysisModeBadge && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  {ANALYSIS_MODE_LABELS[analysisMode]}
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
            <div className="relative flex items-end pb-1.5 pl-2">
              <button
                ref={toggleButtonRef}
                type="button"
                onClick={handleTogglePopover}
                disabled={sessionState?.isLimitReached}
                className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9 ${
                  isPopoverOpen || activeToolCount > 0 || showAnalysisModeBadge
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title="도구 및 옵션"
                aria-label="도구 메뉴 열기"
                aria-expanded={isPopoverOpen}
                aria-haspopup="dialog"
              >
                <Plus
                  className={`h-5 w-5 transition-transform duration-200 ${isPopoverOpen ? 'rotate-45' : ''}`}
                />
              </button>

              {/* Popover */}
              {isPopoverOpen && (
                <div
                  ref={popoverRef}
                  className="absolute bottom-12 left-0 z-50 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
                >
                  {/* RAG source mode */}
                  {onToggleRAG && (
                    <div
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        ragEnabled
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <BookOpen
                        className={`h-4 w-4 ${ragEnabled ? 'text-purple-500' : 'text-gray-400'}`}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="font-medium">RAG 검색 (내부 지식)</div>
                        <div className="text-xs text-gray-500">
                          운영 지식/장애 이력 자동 판단
                        </div>
                      </div>
                      <fieldset className="grid shrink-0 grid-cols-2 gap-0.5 rounded-lg border-0 bg-gray-100 p-0.5">
                        <legend className="sr-only">RAG 검색 모드</legend>
                        {([false, true] as const).map((enabled) => (
                          <button
                            key={String(enabled)}
                            type="button"
                            onClick={() => {
                              if (ragEnabled !== enabled) {
                                onToggleRAG();
                              }
                            }}
                            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                              ragEnabled === enabled
                                ? 'bg-white text-purple-700 shadow-xs'
                                : 'text-gray-500 hover:bg-white/70'
                            }`}
                          >
                            {enabled ? 'On' : 'Auto'}
                          </button>
                        ))}
                      </fieldset>
                    </div>
                  )}

                  {/* Web source mode */}
                  {onToggleWebSearch && (
                    <div
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        webSearchEnabled
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Globe
                        className={`h-4 w-4 ${webSearchEnabled ? 'text-blue-500' : 'text-gray-400'}`}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="font-medium">Web 검색 (외부 웹)</div>
                        <div className="text-xs text-gray-500">
                          최신 문서/CVE는 보수적 자동 판단
                        </div>
                      </div>
                      <fieldset className="grid shrink-0 grid-cols-2 gap-0.5 rounded-lg border-0 bg-gray-100 p-0.5">
                        <legend className="sr-only">Web 검색 모드</legend>
                        {([false, true] as const).map((enabled) => (
                          <button
                            key={String(enabled)}
                            type="button"
                            onClick={() => {
                              if (webSearchEnabled !== enabled) {
                                onToggleWebSearch();
                              }
                            }}
                            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                              webSearchEnabled === enabled
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-gray-500 hover:bg-white/70'
                            }`}
                          >
                            {enabled ? 'On' : 'Auto'}
                          </button>
                        ))}
                      </fieldset>
                    </div>
                  )}

                  {onSelectAnalysisMode && (
                    <>
                      <div className="my-1 border-t border-gray-100" />

                      <div className="px-3 py-2">
                        <div className="mb-2 text-xs font-medium text-gray-500">
                          응답 모드
                        </div>
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                          {(['auto', 'thinking'] as AnalysisMode[]).map(
                            (mode) => {
                              const selected = analysisMode === mode;
                              return (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => onSelectAnalysisMode(mode)}
                                  className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                                    selected
                                      ? 'bg-white text-emerald-700 shadow-xs'
                                      : 'text-gray-600 hover:bg-white/70'
                                  }`}
                                >
                                  {ANALYSIS_MODE_LABELS[mode]}
                                </button>
                              );
                            }
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-gray-500">
                          심층 분석은 숨겨진 모델 추론이 아니라 더 긴
                          분석/라우팅 경로입니다.
                        </p>
                      </div>
                    </>
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
                        이미지/PDF/MD 시각·문서 분석 ({attachments.length}/3)
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
                type="button"
                onClick={onSendWithAttachments}
                disabled={
                  (!inputValue.trim() && attachments.length === 0) ||
                  sessionState?.isLimitReached
                }
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500 text-white shadow-sm transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40 md:h-9 md:w-9"
                title={
                  isGenerating
                    ? streamStatus === 'submitted'
                      ? '요청 전송 중 (대기열에 추가 가능)'
                      : '대기열에 추가'
                    : '메시지 전송'
                }
                aria-label={
                  isGenerating
                    ? streamStatus === 'submitted'
                      ? '요청 전송 중 (대기열에 추가 가능)'
                      : '대기열에 추가'
                    : '메시지 전송'
                }
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

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
              <span>서버 운영 중심</span>
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
