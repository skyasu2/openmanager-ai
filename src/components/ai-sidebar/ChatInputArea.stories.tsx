import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRef } from 'react';
import { fn } from 'storybook/test';
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
  title: 'AI-Sidebar/ChatInputArea',
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
};
