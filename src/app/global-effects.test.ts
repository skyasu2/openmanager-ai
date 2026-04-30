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
