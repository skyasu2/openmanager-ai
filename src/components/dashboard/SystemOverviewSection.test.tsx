/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Server } from '@/types/server';
import { SystemOverviewSection } from './SystemOverviewSection';

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

describe('SystemOverviewSection', () => {
  const servers = [
    {
      id: 'storage-nfs-dc1-01',
      name: 'storage-nfs-dc1-01',
      cpu: 42,
      memory: 68,
      disk: 85,
      status: 'warning',
    },
    {
      id: 'db-mysql-dc1-primary',
      name: 'db-mysql-dc1-primary',
      cpu: 79,
      memory: 61,
      disk: 55,
      status: 'online',
    },
  ] as Server[];

  it('Top 5 경고 클릭 시 AI 컨텍스트 payload를 전달해야 함', () => {
    const onAskAIAboutAlert = vi.fn();

    render(
      <SystemOverviewSection
        servers={servers}
        onAskAIAboutAlert={onAskAIAboutAlert}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /storage-nfs-dc1-01DISK 85%/i,
      })
    );

    expect(onAskAIAboutAlert).toHaveBeenCalledWith({
      serverId: 'storage-nfs-dc1-01',
      serverName: 'storage-nfs-dc1-01',
      metricLabel: 'DISK',
      metricValue: 85,
    });
  });

  it('시스템 리소스 평균은 offline 서버의 0 메트릭을 제외한다', () => {
    render(
      <SystemOverviewSection
        servers={
          [
            {
              id: 'online-1',
              name: 'online-1',
              cpu: 80,
              memory: 60,
              disk: 40,
              status: 'online',
            },
            {
              id: 'offline-1',
              name: 'offline-1',
              cpu: 0,
              memory: 0,
              disk: 0,
              status: 'offline',
            },
          ] as Server[]
        }
      />
    );

    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
