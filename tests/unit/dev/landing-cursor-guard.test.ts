/**
 * @vitest-environment node
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LANDING_RUNTIME_PATH = 'src/app/LandingPageRuntime.tsx';
const LANDING_EFFECTS_PATH = 'src/app/landing-effects.css';
const SYSTEM_START_SECTION_PATH =
  'src/app/main/components/SystemStartSection.tsx';

describe('landing cursor guard', () => {
  it('keeps the landing mouse effect anchored to the start button instead of a custom cursor', () => {
    const runtime = readFileSync(LANDING_RUNTIME_PATH, 'utf8');
    const effects = readFileSync(LANDING_EFFECTS_PATH, 'utf8');
    const startSection = readFileSync(SYSTEM_START_SECTION_PATH, 'utf8');

    expect(runtime).toContain('<MouseSpotlight />');
    expect(startSection).toContain('data-spotlight-anchor="system-start"');

    expect(runtime).not.toContain('CustomCursor');
    expect(runtime).not.toContain('has-custom-cursor');
    expect(effects).not.toContain('.custom-cursor-dot');
    expect(effects).not.toContain('.custom-cursor-ring');
    expect(effects).not.toContain('cursor: none');
  });
});
