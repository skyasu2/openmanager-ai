/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CollapsibleCard from './CollapsibleCard';

describe('CollapsibleCard', () => {
  it('각 카드에 고유한 aria-controls/id 쌍을 사용해야 한다', () => {
    render(
      <div>
        <CollapsibleCard title="First" isExpanded onToggle={vi.fn()}>
          <p>first content</p>
        </CollapsibleCard>
        <CollapsibleCard title="Second" isExpanded onToggle={vi.fn()}>
          <p>second content</p>
        </CollapsibleCard>
      </div>
    );

    const buttons = screen.getAllByRole('button');
    const firstContentId = buttons[0]?.getAttribute('aria-controls');
    const secondContentId = buttons[1]?.getAttribute('aria-controls');

    expect(firstContentId).toBeTruthy();
    expect(secondContentId).toBeTruthy();
    expect(firstContentId).not.toBe(secondContentId);
    expect(document.getElementById(firstContentId!)).toBeTruthy();
    expect(document.getElementById(secondContentId!)).toBeTruthy();
  });
});
