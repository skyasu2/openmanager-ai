/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import { normalizeIncidentSeverity, normalizeIncidentStatus } from './types';

describe('auto-report type normalization', () => {
  it('maps unknown severity values to a safe fallback', () => {
    expect(normalizeIncidentSeverity('urgent')).toBe('critical');
    expect(normalizeIncidentSeverity('unexpected')).toBe('info');
  });

  it('maps legacy status values to current UI statuses', () => {
    expect(normalizeIncidentStatus('open')).toBe('active');
    expect(normalizeIncidentStatus('closed')).toBe('resolved');
    expect(normalizeIncidentStatus('unexpected')).toBe('investigating');
  });
});
