import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createRef } from 'react';
import { fn } from 'storybook/test';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { ChatMessageList } from './ChatMessageList';

function SimpleMessage({ message }: { message: EnhancedChatMessage }) {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      data-testid={message.role === 'user' ? 'user-message' : 'ai-message'}
    >
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 ${
          message.role === 'user'
            ? 'bg-blue-600 text-white'
            : 'border border-gray-200 bg-white text-gray-900'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

const scrollContainerRef = createRef<HTMLDivElement>();
const messagesEndRef = createRef<HTMLDivElement>();

const sampleMessages: EnhancedChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: '서버 상태를 확인해 주세요',
    timestamp: Date.now() - 60000,
  },
  {
    id: '2',
    role: 'assistant',
    content:
      '현재 15대의 서버가 모두 정상 운영 중입니다.\n\n- **웹서버** (3대): CPU 17~30%, Memory 33~48%\n- **API 서버** (3대): CPU 22~47%, Memory 42~51%\n- **DB 서버** (2대): CPU 25~35%, Memory 62~69%',
    timestamp: Date.now() - 30000,
  },
  {
    id: '3',
    role: 'user',
    content: 'cache-redis-dc1-01 서버의 메모리 사용량이 높은 이유는?',
    timestamp: Date.now() - 15000,
  },
  {
    id: '4',
    role: 'assistant',
    content:
      'cache-redis-dc1-01 서버의 메모리 사용률은 74%로, Redis 캐시 서버 특성상 메모리 집약적 운영이 정상입니다. maxmemory-policy가 allkeys-lru로 설정되어 있어 자동으로 관리됩니다.',
    timestamp: Date.now(),
  },
];

const meta = {
  title: 'AI-Sidebar/ChatMessageList',
  component: ChatMessageList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto h-[500px] max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
        <Story />
      </div>
    ),
  ],
  args: {
    scrollContainerRef,
    messagesEndRef,
    MessageComponent: SimpleMessage,
    onFeedback: fn(),
    isGenerating: false,
    regenerateResponse: fn(),
    setInputValue: fn(),
    autoReportTrigger: { shouldGenerate: false },
  },
} satisfies Meta<typeof ChatMessageList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMessages: Story = {
  args: {
    allMessages: sampleMessages,
    limitedMessages: sampleMessages,
  },
};

export const EmptyWelcome: Story = {
  args: {
    allMessages: [],
    limitedMessages: [],
  },
};

export const Generating: Story = {
  args: {
    allMessages: sampleMessages.slice(0, 3),
    limitedMessages: sampleMessages.slice(0, 3),
    isGenerating: true,
  },
};

export const WithAutoReport: Story = {
  args: {
    allMessages: sampleMessages,
    limitedMessages: sampleMessages,
    autoReportTrigger: {
      shouldGenerate: true,
      lastQuery: 'DB 서버 장애 확인',
      severity: 'critical',
    },
  },
};
