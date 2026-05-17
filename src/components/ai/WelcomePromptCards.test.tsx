/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WelcomePromptCards } from './WelcomePromptCards';

const servers = [
  {
    id: 'web-01',
    name: 'web-nginx-dc1-01',
    status: 'online',
    cpu: 30,
    memory: 42,
    disk: 48,
  },
  {
    id: 'cache-01',
    name: 'cache-redis-dc1-01',
    status: 'warning',
    cpu: 64,
    memory: 91,
    disk: 52,
  },
  {
    id: 'backup-01',
    name: 'backup-archive-dc1-01',
    status: 'offline',
    cpu: 0,
    memory: 0,
    disk: 0,
  },
] as const;

describe('WelcomePromptCards', () => {
  it('renders a domain-specific system summary from current server data', () => {
    render(<WelcomePromptCards onPromptClick={vi.fn()} servers={servers} />);

    expect(screen.getByText('운영 상태를 어디부터 볼까요?')).toBeVisible();
    expect(screen.getByText(/3대 중 1대 온라인/)).toBeVisible();
    expect(screen.getByText(/경고 1건/)).toBeVisible();
    expect(screen.getByText(/오프라인 1대/)).toBeVisible();
    expect(screen.getByText(/CPU 평균 47%/)).toBeVisible();
    expect(screen.queryByText('무엇을 도와드릴까요?')).not.toBeInTheDocument();
  });

  it('promotes the highest-risk server as the first starter prompt', () => {
    const onPromptClick = vi.fn();

    render(
      <WelcomePromptCards onPromptClick={onPromptClick} servers={servers} />
    );

    const riskPrompt = screen.getByRole('button', {
      name: /cache-redis-dc1-01 MEM 91%/,
    });

    fireEvent.click(riskPrompt);

    expect(onPromptClick).toHaveBeenCalledWith(
      'cache-redis-dc1-01 서버의 MEM 91% 원인과 즉시 조치 우선순위를 분석해줘'
    );
  });
});
