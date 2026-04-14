/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OTelLogRecord } from '@/types/otel-metrics';
import { LogsTab } from './EnhancedServerModal.LogsTab';

function createStructuredLog({
  timeUnixNano,
  severityText,
  body,
  source,
  resource,
}: {
  timeUnixNano: number;
  severityText: string;
  body: string;
  source: string;
  resource: string;
}): OTelLogRecord {
  return {
    timeUnixNano,
    severityNumber: severityText === 'ERROR' ? 17 : 9,
    severityText,
    body,
    resource,
    attributes: {
      'log.source': source,
      'deployment.environment.name': 'production',
      'cloud.availability_zone': 'DC1-AZ1',
      'server.role': 'web',
    },
  };
}

describe('LogsTab', () => {
  it('streams 뷰에서 job 필터와 확장 토글을 반영해야 한다', () => {
    render(
      <LogsTab
        serverId="server-a"
        serverMetrics={{ cpu: 10, memory: 20, disk: 30, network: 40 }}
        realtimeData={{ cpu: [], memory: [], disk: [], network: [], logs: [] }}
        structuredLogs={[
          createStructuredLog({
            timeUnixNano: 1_710_000_000_000_000_000,
            severityText: 'ERROR',
            body: 'server-a nginx error',
            source: 'nginx',
            resource: 'server-a',
          }),
          createStructuredLog({
            timeUnixNano: 1_710_000_001_000_000_000,
            severityText: 'INFO',
            body: 'server-a redis info',
            source: 'redis',
            resource: 'server-a',
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Streams' }));
    fireEvent.click(screen.getByRole('button', { name: 'nginx' }));
    expect(screen.getByText('{job="nginx"}')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /job=nginx/i }));
    expect(screen.getByText('server-a nginx error')).toBeInTheDocument();
  });
});
