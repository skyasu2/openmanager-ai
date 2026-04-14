/**
 * @vitest-environment jsdom
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UnifiedCircularGauge from './UnifiedCircularGauge';

describe('UnifiedCircularGauge', () => {
  it('같은 label/type 조합이 반복 렌더되어도 SVG defs id가 충돌하지 않아야 한다', () => {
    const { container } = render(
      <div>
        <UnifiedCircularGauge
          value={35}
          label="CPU"
          type="cpu"
          variant="modal-3d"
        />
        <UnifiedCircularGauge
          value={72}
          label="CPU"
          type="cpu"
          variant="modal-3d"
        />
      </div>
    );

    const gradientIds = Array.from(
      container.querySelectorAll('linearGradient')
    ).map((node) => node.getAttribute('id'));
    const radialIds = Array.from(
      container.querySelectorAll('radialGradient')
    ).map((node) => node.getAttribute('id'));
    const shadowIds = Array.from(container.querySelectorAll('filter')).map(
      (node) => node.getAttribute('id')
    );

    expect(new Set(gradientIds).size).toBe(2);
    expect(new Set(radialIds).size).toBe(2);
    expect(new Set(shadowIds).size).toBe(2);
  });
});
