import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global anchor reset', () => {
  it('keeps anchor reset specificity below Tailwind text utilities', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/app/global-effects.css'),
      'utf8'
    );

    expect(css).toContain(':where(a) {');
    expect(css).toContain(":where(a:not([class*='text-'])) {");
    expect(css).not.toMatch(/(^|\n)\s*a\s*\{\s*color:\s*inherit;/);
    expect(css).not.toMatch(/:where\(a\)\s*\{[^}]*color:\s*inherit;/s);
  });
});

describe('AI gradient effects', () => {
  it('moves gradient-diagonal with background-position instead of opacity', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/app/global-effects.css'),
      'utf8'
    );

    const keyframesStart = css.indexOf('@keyframes gradient-diagonal');
    const keyframesEnd = css.indexOf('.animate-gradient-diagonal');
    const keyframes = css.slice(keyframesStart, keyframesEnd);

    expect(keyframesStart).toBeGreaterThanOrEqual(0);
    expect(keyframesEnd).toBeGreaterThan(keyframesStart);
    expect(keyframes).toContain('background-position: 0% 50%');
    expect(keyframes).toContain('background-position: 100% 50%');
    expect(keyframes).not.toContain('opacity:');
    expect(css).toContain('will-change: background-position');
  });
});
