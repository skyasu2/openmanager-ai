import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="metrics">메트릭</TabsTrigger>
        <TabsTrigger value="logs">로그</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">
          서버 개요 정보가 여기에 표시됩니다.
        </p>
      </TabsContent>
      <TabsContent value="metrics" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">CPU, Memory, Disk 메트릭</p>
      </TabsContent>
      <TabsContent value="logs" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">최근 시스템 로그</p>
      </TabsContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-[300px]">
      <TabsList>
        <TabsTrigger value="active">활성</TabsTrigger>
        <TabsTrigger value="inactive">비활성</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">활성 서버 목록</p>
      </TabsContent>
      <TabsContent value="inactive" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">비활성 서버 목록</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="metrics">메트릭</TabsTrigger>
        <TabsTrigger value="network" disabled>
          네트워크
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">개요 탭 활성</p>
      </TabsContent>
      <TabsContent value="metrics" className="rounded-md border p-4">
        <p className="text-sm text-gray-600">메트릭 탭</p>
      </TabsContent>
    </Tabs>
  ),
};
