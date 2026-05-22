/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import {
  type ComponentProps,
  createRef,
  forwardRef,
  type ImgHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
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

describe('ChatInputArea controls', () => {
  const renderComponent = (
    overrides: Partial<ComponentProps<typeof ChatInputArea>> = {}
  ) =>
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
        {...overrides}
      />
    );

  it('keeps input action buttons at 44px on mobile and compact on desktop', () => {
    renderComponent();

    const attach = screen.getByRole('button', { name: '파일 첨부' });
    const web = screen.getByRole('button', { name: 'Web 검색' });
    const send = screen.getByRole('button', { name: '메시지 전송' });

    for (const button of [attach, web, send]) {
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('w-11');
      expect(button).toHaveClass('md:h-9');
      expect(button).toHaveClass('md:w-9');
    }
  });

  it('exposes file attachment and Web search directly without the plus tool menu', () => {
    const onOpenFileDialog = vi.fn();
    const onToggleWebSearch = vi.fn();

    renderComponent({ onOpenFileDialog, onToggleWebSearch });

    expect(
      screen.queryByRole('button', { name: '도구 메뉴 열기' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '파일 첨부' }));
    fireEvent.click(screen.getByRole('button', { name: 'Web 검색' }));

    expect(onOpenFileDialog).toHaveBeenCalledTimes(1);
    expect(onToggleWebSearch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('RAG 검색 (내부 지식)')).not.toBeInTheDocument();
  });

  it('keeps the default footer hint minimal', () => {
    renderComponent({
      sessionState: undefined,
      inputValue: 'CPU 상태 알려줘',
      attachments: [],
    });

    expect(screen.getByText('Shift+Enter로 줄바꿈')).toBeInTheDocument();
    expect(screen.queryByText('서버 운영 중심')).not.toBeInTheDocument();
    expect(screen.queryByText(/대화 \d+\/50/)).not.toBeInTheDocument();
    expect(screen.queryByText(/입력 \d/)).not.toBeInTheDocument();
  });

  it('uses the unified white input surface with subtle purple border', () => {
    const { container } = renderComponent();

    const root = container.firstElementChild;

    expect(root).toHaveClass('bg-white');
    expect(root).toHaveClass('border-purple-100');
    expect(root).not.toHaveClass('bg-white/80');
    expect(root).not.toHaveClass('border-gray-200');
  });

  it('shows an explicit warning near the session limit', () => {
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
        sessionState={{
          count: 40,
          remaining: 10,
          isWarning: true,
          isLimitReached: false,
        }}
      />
    );

    expect(screen.getByText('대화 40/50')).toHaveClass('text-amber-700');
    expect(screen.getByText('곧 한도 도달')).toBeInTheDocument();
  });

  it('caps the chat textarea at the backend input limit', () => {
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
      />
    );

    expect(
      screen.getByRole('textbox', { name: 'AI 질문 입력' })
    ).toHaveAttribute('maxlength', '10000');
  });

  it('shows character usage warning before the input hard cap', () => {
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue={'a'.repeat(8000)}
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
      />
    );

    expect(screen.getByText('입력 8,000/10,000자')).toHaveClass(
      'text-amber-700'
    );
  });

  it('shows hard cap guidance when the input reaches 10,000 characters', () => {
    render(
      <ChatInputArea
        textareaRef={createRef<HTMLTextAreaElement>()}
        fileInputRef={createRef<HTMLInputElement>()}
        inputValue={'a'.repeat(10_000)}
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
      />
    );

    expect(screen.getByText('입력 10,000/10,000자')).toHaveClass(
      'text-red-700'
    );
    expect(
      screen.getByText('최대 입력 길이에 도달했습니다')
    ).toBeInTheDocument();
  });

  it('shows a new conversation hint when the session limit is reached', () => {
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
        sessionState={{
          count: 50,
          remaining: 0,
          isWarning: true,
          isLimitReached: true,
        }}
      />
    );

    expect(
      screen.getByText('새 대화를 시작하면 계속 이용할 수 있습니다')
    ).toBeInTheDocument();
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

    expect(
      screen.getByRole('button', { name: 'Web 검색' })
    ).toBeInTheDocument();
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

    const webButton = screen.getByRole('button', { name: 'Web 검색' });

    expect(webButton).toHaveAttribute('aria-pressed', 'true');
    expect(webButton).toHaveClass('bg-blue-50');
    expect(webButton).toHaveClass('text-blue-600');
    expect(screen.queryByText('Web On')).not.toBeInTheDocument();
    expect(screen.queryByText('RAG On')).not.toBeInTheDocument();
    expect(screen.queryByText('지식 검색 사용됨')).not.toBeInTheDocument();
    expect(screen.queryByText('Web 사용됨')).not.toBeInTheDocument();
  });

  it('does not expose the removed response mode selector', () => {
    renderComponent();

    expect(
      screen.queryByRole('button', { name: '응답 모드 선택' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('응답 모드')).not.toBeInTheDocument();
  });
});
