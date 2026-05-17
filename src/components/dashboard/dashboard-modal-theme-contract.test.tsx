/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AILoginRequiredModal } from './AILoginRequiredModal';
import { TopologyModal } from './TopologyModal';

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockDynamicDiagram() {
      return <div data-testid="mock-topology-diagram" />;
    },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('dashboard modal light-mode contract', () => {
  it('TopologyModal keeps a light shell and light graph canvas', () => {
    render(<TopologyModal open onClose={vi.fn()} servers={[]} />);

    const shell = screen.getByTestId('topology-modal-shell');
    const canvas = screen.getByTestId('topology-modal-canvas');

    expect(shell).toHaveClass('bg-white');
    expect(shell).not.toHaveClass('bg-slate-900');
    expect(canvas).toHaveClass('bg-slate-50');
  });

  it('AILoginRequiredModal uses the dashboard light dialog shell', () => {
    render(<AILoginRequiredModal open onClose={vi.fn()} />);

    const shell = screen.getByTestId('ai-login-required-modal-shell');

    expect(shell).toHaveClass('bg-white');
    expect(shell).toHaveClass('text-gray-900');
    expect(shell.className).not.toContain('from-slate-900');
  });
});
