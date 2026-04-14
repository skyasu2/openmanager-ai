/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineAgentStatus } from './InlineAgentStatus';

describe('InlineAgentStatus', () => {
  it('renders nothing when there are no agent steps', () => {
    const { container } = render(
      <InlineAgentStatus steps={[]} isComplete={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the active agent step when processing is in progress', () => {
    render(
      <InlineAgentStatus
        steps={[
          {
            id: 'step-1',
            agent: 'supervisor',
            status: 'processing',
            message: '라우팅 중',
          },
        ]}
        isComplete={false}
      />
    );

    expect(screen.getByText('라우팅 - 라우팅 중')).toBeInTheDocument();
  });
});
