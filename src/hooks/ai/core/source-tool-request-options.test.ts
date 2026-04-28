import { describe, expect, it } from 'vitest';
import { buildSourceToolRequestOptions } from './source-tool-request-options';

describe('buildSourceToolRequestOptions', () => {
  it('omits source tool flags in Auto mode so Cloud Run can apply conservative detection', () => {
    expect(
      buildSourceToolRequestOptions({
        ragEnabled: false,
        webSearchEnabled: false,
      })
    ).toEqual({});
  });

  it('sends true only when the user explicitly selects On', () => {
    expect(
      buildSourceToolRequestOptions({
        ragEnabled: true,
        webSearchEnabled: true,
      })
    ).toEqual({
      enableRAG: true,
      enableWebSearch: true,
    });
  });
});
