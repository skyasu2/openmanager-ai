import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_TEXT_GRADIENT_CRISP_STYLE } from '@/styles/design-constants';

function readLandingEffectsCss(): string {
  return readFileSync(
    join(process.cwd(), 'src/app/landing-effects.css'),
    'utf8'
  );
}

function extractCssBlock(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf('\n}', start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return css.slice(start, end);
}

describe('landing hero AI title clarity', () => {
  it('keeps the AI title free of glow, blur, and blend effects', () => {
    const block = extractCssBlock(readLandingEffectsCss(), '.landing-title-ai');

    expect(block).toContain('filter: none;');
    expect(block).toContain('mix-blend-mode: normal;');
    expect(block).toContain('opacity: 1;');
    expect(block).toContain('text-shadow: none;');
    expect(block).not.toMatch(/drop-shadow|blur\(/);
  });

  it('uses a static high-contrast gradient for the AI title', () => {
    expect(AI_TEXT_GRADIENT_CRISP_STYLE.background).toBe(
      'linear-gradient(135deg, #a5f3fc 0%, #60a5fa 48%, #c4b5fd 100%)'
    );
    expect(AI_TEXT_GRADIENT_CRISP_STYLE.backgroundSize).toBe('100% 100%');
    expect(AI_TEXT_GRADIENT_CRISP_STYLE.color).toBe('transparent');
    expect(AI_TEXT_GRADIENT_CRISP_STYLE).not.toHaveProperty('animation');
  });
});
