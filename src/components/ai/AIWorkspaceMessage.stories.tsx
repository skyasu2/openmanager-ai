import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import { AIWorkspaceMessage } from './AIWorkspaceMessage';

const userMessage: EnhancedChatMessage = {
  id: 'msg-1',
  role: 'user',
  content: '서버 상태를 확인해 주세요',
  timestamp: Date.now(),
};

const assistantMessage: EnhancedChatMessage = {
  id: 'msg-2',
  role: 'assistant',
  content: `현재 15대의 서버가 모두 **정상 운영** 중입니다.

### 서버 그룹별 현황
| 그룹 | 서버 수 | CPU 평균 | Memory 평균 |
|------|:------:|:-------:|:----------:|
| 웹서버 | 3대 | 25.7% | 39.7% |
| API 서버 | 3대 | 37.0% | 47.7% |
| DB 서버 | 2대 | 30.0% | 65.5% |

> 모든 서버가 안정적인 범위 내에서 운영되고 있습니다.`,
  timestamp: Date.now(),
};

const longAssistantMessage: EnhancedChatMessage = {
  id: 'msg-3',
  role: 'assistant',
  content: `## cache-redis-dc1-01 메모리 분석

Redis 서버의 메모리 사용률이 **74%**로 확인됩니다.

### 원인 분석
1. **캐시 히트율**: 92.3% — 효율적인 캐시 운영
2. **maxmemory-policy**: \`allkeys-lru\` — 자동 정리 활성화
3. **키 수**: 약 2.4M개 — 정상 범위

### 권장 조치
- 현재 수준은 Redis 캐시 서버의 **정상 운영 범위**입니다
- 80% 이상 시 \`maxmemory\` 설정 검토 권장
- \`INFO memory\` 명령으로 상세 확인 가능

\`\`\`bash
redis-cli -h 10.100.3.11 INFO memory
\`\`\``,
  timestamp: Date.now(),
  traceId: 'trace-abc-123',
};

const meta = {
  title: 'AI/AIWorkspaceMessage',
  component: AIWorkspaceMessage,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl bg-gray-50 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    onRegenerateResponse: fn(),
    onFeedback: fn(),
    isLastMessage: false,
  },
} satisfies Meta<typeof AIWorkspaceMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UserMessage: Story = {
  args: { message: userMessage },
};

export const AssistantMessage: Story = {
  args: { message: assistantMessage },
};

export const AssistantWithMarkdown: Story = {
  args: { message: longAssistantMessage, isLastMessage: true },
};

export const Conversation: Story = {
  render: (args) => (
    <div className="space-y-4">
      <AIWorkspaceMessage {...args} message={userMessage} />
      <AIWorkspaceMessage {...args} message={assistantMessage} />
      <AIWorkspaceMessage
        {...args}
        message={{
          ...userMessage,
          id: 'msg-follow',
          content: 'cache-redis-dc1-01 메모리가 높은 이유는?',
        }}
      />
      <AIWorkspaceMessage
        {...args}
        message={longAssistantMessage}
        isLastMessage={true}
      />
    </div>
  ),
};
