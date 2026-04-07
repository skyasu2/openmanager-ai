import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

const meta = {
  title: 'UI/Accordion',
  component: Accordion,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>서버 상태란?</AccordionTrigger>
        <AccordionContent>
          서버의 현재 운영 상태를 나타냅니다. 정상(online), 경고(warning),
          심각(critical), 오프라인(offline) 등이 있습니다.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>AI 분석은 어떻게 작동하나요?</AccordionTrigger>
        <AccordionContent>
          서버 메트릭 데이터를 실시간으로 수집하여 AI 엔진이 이상 패턴을
          감지하고 자동으로 알림을 제공합니다.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>알림 설정은 어디서 하나요?</AccordionTrigger>
        <AccordionContent>
          대시보드 상단의 설정 아이콘을 클릭하면 알림 임계치와 알림 채널을
          구성할 수 있습니다.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const ExpandOnClick: Story = {
  render: () => (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>클릭하여 열기</AccordionTrigger>
        <AccordionContent>아코디언 콘텐츠가 표시됩니다.</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: '클릭하여 열기' })
    );
    await expect(
      canvas.getByText('아코디언 콘텐츠가 표시됩니다.')
    ).toBeVisible();
  },
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={['item-1']}>
      <AccordionItem value="item-1">
        <AccordionTrigger>CPU 사용률</AccordionTrigger>
        <AccordionContent>
          현재 평균 CPU 사용률: 45%. 경고 임계치: 70%, 위험 임계치: 85%.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>메모리 사용률</AccordionTrigger>
        <AccordionContent>
          현재 평균 메모리 사용률: 62%. 경고 임계치: 80%, 위험 임계치: 90%.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>디스크 사용률</AccordionTrigger>
        <AccordionContent>
          현재 평균 디스크 사용률: 38%. 경고 임계치: 80%, 위험 임계치: 95%.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
