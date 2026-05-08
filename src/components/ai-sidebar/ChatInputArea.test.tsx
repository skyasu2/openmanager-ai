/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import {
  createRef,
  forwardRef,
  type ImgHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInputArea } from './ChatInputArea';

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/performance/noImgElement: test stub
    <img {...props} alt={props.alt ?? ''} />
  ),
}));

vi.mock('@/components/ui/AutoResizeTextarea', () => ({
  AutoResizeTextarea: forwardRef<
    HTMLTextAreaElement,
    {
      value: string;
      onValueChange: (value: string) => void;
    } & TextareaHTMLAttributes<HTMLTextAreaElement>
  >(
    (
      {
        value,
        onValueChange,
        onKeyboardShortcut: _onKeyboardShortcut,
        minHeight: _minHeight,
        maxHeight: _maxHeight,
        maxHeightVh: _maxHeightVh,
        ...props
      }: {
        value: string;
        onValueChange: (value: string) => void;
        onKeyboardShortcut?: () => void;
        minHeight?: number;
        maxHeight?: number;
        maxHeightVh?: number;
      } & TextareaHTMLAttributes<HTMLTextAreaElement>,
      ref
    ) => (
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
    )
  ),
}));

vi.mock('@/components/ui/ImagePreviewModal', () => ({
  ImagePreviewModal: () => null,
}));

describe('ChatInputArea popover', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    }) as typeof requestAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  });

  const renderComponent = () =>
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue=""
        setInputValue={vi.fn()}
        isGenerating={false}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={vi.fn()}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
        onToggleWebSearch={vi.fn()}
        onSelectAnalysisMode={vi.fn()}
      />
    );

  it('closes the tool popover on outside touch interaction', () => {
    renderComponent();

    const toggle = screen.getByRole('button', { name: '도구 메뉴 열기' });
    fireEvent.click(toggle);

    expect(screen.getByText('Web 검색 (외부 웹)')).toBeInTheDocument();
    expect(
      screen.getByText('최신 문서/CVE는 보수적 자동 판단')
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Auto' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'On' })).toHaveLength(1);
    expect(screen.queryByText('RAG 검색 (내부 지식)')).not.toBeInTheDocument();

    fireEvent.touchStart(document.body);

    expect(screen.queryByText('Web 검색 (외부 웹)')).not.toBeInTheDocument();
  });

  it('closes the tool popover on Escape and restores focus to the toggle button', () => {
    renderComponent();

    const toggle = screen.getByRole('button', { name: '도구 메뉴 열기' });
    fireEvent.click(toggle);

    expect(screen.getByText('Web 검색 (외부 웹)')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Web 검색 (외부 웹)')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('keeps input action buttons at 44px on mobile and compact on desktop', () => {
    renderComponent();

    const toggle = screen.getByRole('button', { name: '도구 메뉴 열기' });
    const send = screen.getByRole('button', { name: '메시지 전송' });

    for (const button of [toggle, send]) {
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('w-11');
      expect(button).toHaveClass('md:h-9');
      expect(button).toHaveClass('md:w-9');
    }
  });

  it('wraps the AI textarea in a submit form and submits through the send handler', () => {
    const onSendWithAttachments = vi.fn();

    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue="Nginx 액세스 로그에서 5xx 에러가 많이 나는 경로 분석하는 방법 알려줘"
        setInputValue={vi.fn()}
        isGenerating={false}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={onSendWithAttachments}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox', { name: 'AI 질문 입력' });
    const form = input.closest('form');

    expect(form).not.toBeNull();
    expect(screen.getByRole('button', { name: '메시지 전송' })).toHaveAttribute(
      'type',
      'submit'
    );

    fireEvent.submit(form!);

    expect(onSendWithAttachments).toHaveBeenCalledTimes(1);
  });

  it('disables the send button while a generation is in progress', () => {
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue="장애 보고서 작성해줘"
        setInputValue={vi.fn()}
        isGenerating={true}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={vi.fn()}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
        onToggleWebSearch={vi.fn()}
        onSelectAnalysisMode={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '요청 처리 중' })).toBeDisabled();
  });

  it('keeps Web source control visible and removes user-facing RAG control', () => {
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue=""
        setInputValue={vi.fn()}
        isGenerating={false}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={vi.fn()}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
        onToggleWebSearch={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '도구 메뉴 열기' }));

    expect(screen.getByText('Web 검색 (외부 웹)')).toBeInTheDocument();
    expect(screen.queryByText('RAG 검색 (내부 지식)')).not.toBeInTheDocument();
    expect(screen.queryByText('외부 웹')).not.toBeInTheDocument();
  });

  it('labels active Web input badge as forced On rather than a used tool', () => {
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue=""
        setInputValue={vi.fn()}
        isGenerating={false}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={vi.fn()}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
        webSearchEnabled={true}
        onToggleWebSearch={vi.fn()}
      />
    );

    expect(screen.getByText('Web On')).toBeInTheDocument();
    expect(screen.queryByText('RAG On')).not.toBeInTheDocument();
    expect(screen.queryByText('RAG 사용됨')).not.toBeInTheDocument();
    expect(screen.queryByText('Web 사용됨')).not.toBeInTheDocument();
  });

  it('shows analysis mode as app-level deep analysis, not provider-native Thinking', () => {
    const onSelectAnalysisMode = vi.fn();

    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue=""
        setInputValue={vi.fn()}
        isGenerating={false}
        attachments={[]}
        isDragging={false}
        fileErrors={[]}
        canAddMore={true}
        previewImage={null}
        dragHandlers={{}}
        onSendWithAttachments={vi.fn()}
        onOpenFileDialog={vi.fn()}
        onFileSelect={vi.fn()}
        onImageClick={vi.fn()}
        onClosePreviewModal={vi.fn()}
        onRemoveFile={vi.fn()}
        onClearFileErrors={vi.fn()}
        onPaste={vi.fn()}
        onToggleWebSearch={vi.fn()}
        onSelectAnalysisMode={onSelectAnalysisMode}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '도구 메뉴 열기' }));

    expect(screen.queryByRole('button', { name: 'Thinking' })).toBeNull();
    expect(
      screen.getByRole('button', { name: '심층 분석' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/숨겨진 모델 추론이 아니라 더 긴 분석/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '심층 분석' }));

    expect(onSelectAnalysisMode).toHaveBeenCalledWith('thinking');
  });
});
