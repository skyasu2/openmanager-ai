import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import type { IncidentReport } from './types';
import ReportCard from './ReportCard';

const baseReport: IncidentReport = {
  id: 'report-1',
  title: 'Redis 메모리 사용량 급증',
  severity: 'critical',
  timestamp: new Date('2026-02-28T10:30:00'),
  affectedServers: ['cache-redis-dc1-01', 'cache-redis-dc1-02'],
  description: 'Redis 캐시 서버 2대에서 메모리 사용률이 90%를 초과했습니다.',
  status: 'active',
  systemSummary: {
    totalServers: 15,
    healthyServers: 11,
    warningServers: 2,
    criticalServers: 2,
  },
  anomalies: [
    { server_id: 's1', server_name: 'cache-redis-dc1-01', metric: 'memory', value: 94, severity: 'critical' },
    { server_id: 's2', server_name: 'cache-redis-dc1-02', metric: 'memory', value: 91, severity: 'critical' },
  ],
  recommendations: [
    { action: 'maxmemory-policy 확인 및 eviction 모니터링', priority: '높음', expected_impact: '메모리 안정화' },
    { action: 'TTL 없는 키 점검', priority: '중간', expected_impact: '불필요 데이터 정리' },
  ],
};

const meta = {
  title: 'AI/AutoReport/ReportCard',
  component: ReportCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    index: 0,
    isSelected: false,
    downloadMenuId: null,
    onToggleDetail: fn(),
    onResolve: fn(),
    onSetDownloadMenuId: fn(),
  },
} satisfies Meta<typeof ReportCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critical: Story = {
  args: { report: baseReport },
};

export const Warning: Story = {
  args: {
    report: {
      ...baseReport,
      id: 'report-2',
      title: 'API 서버 CPU 사용률 상승',
      severity: 'warning',
      status: 'investigating',
      affectedServers: ['api-server-01'],
      description: 'API 서버 CPU 사용률이 75%로 경고 수준에 도달했습니다.',
    },
  },
};

export const Resolved: Story = {
  args: {
    report: {
      ...baseReport,
      id: 'report-3',
      title: '디스크 사용량 정리 완료',
      severity: 'info',
      status: 'resolved',
      affectedServers: ['backup-server-01'],
      description: '백업 서버 디스크 사용률이 정상 범위로 돌아왔습니다.',
    },
  },
};

export const Expanded: Story = {
  args: {
    report: baseReport,
    isSelected: true,
  },
};
