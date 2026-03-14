import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownRenderer } from './MarkdownRenderer';

const meta = {
  title: 'AI/MarkdownRenderer',
  component: MarkdownRenderer,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  args: {
    content: `## 서버 상태 요약

현재 **15개 서버** 중 13개가 정상 운영 중입니다. 2개 서버에서 경고가 감지되었습니다.

- **web-server-03**: CPU 사용률 92% (임계치 초과)
- **db-replica-02**: 디스크 I/O 지연 발생 (평균 45ms)

> 즉각적인 조치가 필요한 서버는 web-server-03입니다. nginx worker 프로세스 재시작을 권장합니다.`,
  },
};

export const CodeBlock: Story = {
  args: {
    content: `서버 프로세스를 확인하려면 다음 명령어를 사용하세요:

\`\`\`bash
# CPU 사용률 상위 프로세스 조회
top -bn1 | head -20

# nginx worker 프로세스 확인
ps aux | grep nginx

# 서비스 재시작
sudo systemctl restart nginx
\`\`\`

인라인 코드 예시: \`systemctl status nginx\` 명령어로 상태를 확인할 수 있습니다.`,
  },
};

export const Table: Story = {
  args: {
    content: `## 서버 리소스 현황

| 서버명 | CPU | 메모리 | 디스크 | 상태 |
|--------|-----|--------|--------|------|
| web-server-01 | 45% | 62% | 71% | 정상 |
| web-server-02 | 38% | 55% | 68% | 정상 |
| web-server-03 | 92% | 78% | 75% | 경고 |
| db-primary-01 | 52% | 81% | 45% | 정상 |
| db-replica-02 | 41% | 59% | 89% | 경고 |`,
  },
};

export const Handoff: Story = {
  args: {
    content: `사용자 질문을 분석하고 있습니다.

🔄 **Orchestrator** → **NLQ Agent**: 서버 메트릭 조회 요청

서버 데이터를 조회한 결과, web-server-03의 CPU 사용률이 높습니다.

🔄 **NLQ Agent** → **Analyst Agent**: 패턴 분석 필요

분석이 완료되었습니다. 최근 트래픽 급증이 원인으로 보입니다.`,
  },
};
