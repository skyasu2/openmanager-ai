import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

const meta = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const servers = [
  { name: 'web-server-01', status: 'online', cpu: 45, memory: 62 },
  { name: 'api-server-01', status: 'warning', cpu: 78, memory: 85 },
  { name: 'db-primary', status: 'online', cpu: 32, memory: 71 },
  { name: 'worker-01', status: 'critical', cpu: 95, memory: 92 },
  { name: 'cache-01', status: 'offline', cpu: 0, memory: 0 },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>서버 모니터링 현황</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>서버명</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">CPU (%)</TableHead>
          <TableHead className="text-right">Memory (%)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {servers.map((server) => (
          <TableRow key={server.name}>
            <TableCell className="font-medium">{server.name}</TableCell>
            <TableCell>
              <Badge
                variant={
                  server.status === 'online'
                    ? 'success'
                    : server.status === 'warning'
                      ? 'warning'
                      : server.status === 'critical'
                        ? 'destructive'
                        : 'secondary'
                }
              >
                {server.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{server.cpu}</TableCell>
            <TableCell className="text-right">{server.memory}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Simple: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>항목</TableHead>
          <TableHead className="text-right">값</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>총 서버</TableCell>
          <TableCell className="text-right">15</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>정상</TableCell>
          <TableCell className="text-right">12</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>경고</TableCell>
          <TableCell className="text-right">2</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>장애</TableCell>
          <TableCell className="text-right">1</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
