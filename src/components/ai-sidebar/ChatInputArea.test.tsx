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

    expect(screen.getByText('Web 검색')).toBeInTheDocument();
    expect(screen.getByText('최신 외부 정보 확인')).toBeInTheDocument();

    fireEvent.touchStart(document.body);

    expect(screen.queryByText('Web 검색')).not.toBeInTheDocument();
  });

  it('closes the tool popover on Escape and restores focus to the toggle button', () => {
    renderComponent();

    const toggle = screen.getByRole('button', { name: '도구 메뉴 열기' });
    fireEvent.click(toggle);

    expect(screen.getByText('Web 검색')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('Web 검색')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('labels active input badges as allowed tools rather than used tools', () => {
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
        ragEnabled={true}
        onToggleRAG={vi.fn()}
        webSearchEnabled={true}
        onToggleWebSearch={vi.fn()}
      />
    );

    expect(screen.getByText('RAG 허용')).toBeInTheDocument();
    expect(screen.getByText('Web 허용')).toBeInTheDocument();
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
