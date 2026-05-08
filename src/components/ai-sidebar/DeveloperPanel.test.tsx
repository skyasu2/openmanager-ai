/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import { DeveloperPanel } from './DeveloperPanel';

const developerPanelData: DeveloperPanelData = {
  ts: '2026-05-08T02:40:00.000Z',
  session: {
    provider: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    handoffCount: 2,
    durationMs: 1234,
    toolsCalled: ['getServerMetrics', 'searchKnowledgeBase'],
  },
  stream: {
    analysisBasis: 'multi-agent',
    stepsExecuted: 2,
    tokensUsed: 512,
  },
  system: {
    cloudRunHealthy: true,
    cloudRunUrl: 'https://example-ai.run.app',
    disclosureMode: 'developer',
  },
  rag: {
    ragType: 'lite',
    hitCount: 3,
    graphHits: 0,
    vectorHits: 3,
  },
};

describe('DeveloperPanel', () => {
  it('renders a hidden developer-panel mount with parseable data-panel-json', () => {
    render(<DeveloperPanel data={developerPanelData} />);

    const panel = screen.getByTestId('developer-panel');
    expect(panel).toHaveAttribute('hidden');

    const raw = panel.getAttribute('data-panel-json');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw ?? '')).toMatchObject({
      session: {
        provider: 'groq',
        modelId: 'llama-3.3-70b-versatile',
        handoffCount: 2,
      },
      system: {
        cloudRunHealthy: true,
        disclosureMode: 'developer',
      },
      rag: {
        ragType: 'lite',
        hitCount: 3,
      },
    });
  });

  it('does not render for user mode without developer panel data', () => {
    render(<DeveloperPanel data={null} />);

    expect(screen.queryByTestId('developer-panel')).toBeNull();
  });
});
