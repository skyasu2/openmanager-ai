import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRef } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatInputArea } from './ChatInputArea';

const textareaRef = createRef<HTMLTextAreaElement>();
const fileInputRef = createRef<HTMLInputElement>();

const noopDragHandlers = {
  onDragEnter: fn(),
  onDragLeave: fn(),
  onDragOver: fn(),
  onDrop: fn(),
};

const meta = {
  title: 'AISidebar/ChatInputArea',
  component: ChatInputArea,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    textareaRef,
    fileInputRef,
    inputValue: '',
    setInputValue: fn(),
    isGenerating: false,
    attachments: [],
    isDragging: false,
    fileErrors: [],
    canAddMore: true,
    previewImage: null,
    dragHandlers: noopDragHandlers,
    onSendWithAttachments: fn(),
    onOpenFileDialog: fn(),
    onFileSelect: fn(),
    onImageClick: fn(),
    onClosePreviewModal: fn(),
    onRemoveFile: fn(),
    onClearFileErrors: fn(),
    onPaste: fn(),
    onStopGeneration: fn(),
    webSearchEnabled: false,
    onToggleWebSearch: fn(),
  },
} satisfies Meta<typeof ChatInputArea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithText: Story = {
  args: { inputValue: '서버 상태를 확인해 주세요' },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('sends a non-empty operations query', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: '메시지 전송' })
      );
      await expect(args.onSendWithAttachments).toHaveBeenCalled();
    });
  },
};

export const Generating: Story = {
  args: {
    inputValue: '',
    isGenerating: true,
  },
};

export const WithAttachments: Story = {
  args: {
    attachments: [
      {
        id: '1',
        file: new File([''], 'error-log.txt', { type: 'text/plain' }),
        name: 'error-log.txt',
        size: 2048,
        type: 'text/plain',
        status: 'ready' as const,
      },
    ],
  },
};

export const Dragging: Story = {
  args: { isDragging: true },
};

export const WithFileError: Story = {
  args: {
    fileErrors: [{ message: '파일 크기가 10MB를 초과합니다.' }],
  },
};

export const WebSearchEnabled: Story = {
  args: {
    inputValue: 'Next.js 16 새 기능',
    webSearchEnabled: true,
  },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('opens tools and switches web search back to auto', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: '도구 메뉴 열기' })
      );

      const toolsDialog = canvas.getByRole('dialog', {
        name: '도구 및 옵션',
      });
      const tools = within(toolsDialog);

      await expect(tools.getByText('Web 검색 (외부 웹)')).toBeInTheDocument();
      await userEvent.click(tools.getByRole('button', { name: 'Auto' }));
      await expect(args.onToggleWebSearch).toHaveBeenCalled();
    });
  },
};
