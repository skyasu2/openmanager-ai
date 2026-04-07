import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { WebSourceCards } from './WebSourceCards';

const meta = {
  title: 'AI/WebSourceCards',
  component: WebSourceCards,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WebSourceCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleSource: Story = {
  args: {
    sources: [
      {
        title: 'Kubernetes Pod 리소스 관리 가이드',
        url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
        sourceType: 'web',
      },
    ],
  },
};

export const MultipleSources: Story = {
  args: {
    sources: [
      {
        title: 'Linux 서버 CPU 사용률 최적화 방법',
        url: 'https://docs.kernel.org/admin-guide/cpu-load.html',
        sourceType: 'web',
      },
      {
        title: 'Nginx 성능 튜닝 가이드',
        url: 'https://nginx.org/en/docs/http/ngx_http_core_module.html',
        sourceType: 'web',
      },
      {
        title: 'Prometheus 메트릭 쿼리 레퍼런스',
        url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/',
        sourceType: 'web',
      },
    ],
  },
};
