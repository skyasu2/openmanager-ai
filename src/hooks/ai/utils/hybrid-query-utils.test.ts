import type { UIMessage } from '@ai-sdk/react';
import { describe, expect, it } from 'vitest';
import { generateMessageId, sanitizeMessages } from './hybrid-query-utils';

const makeMsg = (
  overrides: Partial<UIMessage> & { parts?: UIMessage['parts'] }
): UIMessage => ({
  id: 'test-1',
  role: 'user',
  content: 'hello',
  parts: [{ type: 'text', text: 'hello' }],
  ...overrides,
});

describe('generateMessageId', () => {
  it('returns string with given prefix', () => {
    const id = generateMessageId('custom');
    expect(id).toMatch(/^custom-/);
  });

  it('uses "msg" as default prefix', () => {
    const id = generateMessageId();
    expect(id).toMatch(/^msg-/);
  });

  it('returns unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateMessageId()));
    expect(ids.size).toBe(50);
  });
});

describe('sanitizeMessages', () => {
  it('returns empty array for empty input', () => {
    expect(sanitizeMessages([])).toEqual([]);
  });

  it('adds default text part when parts is undefined', () => {
    const msg = makeMsg({}) as UIMessage & { parts: undefined };
    // Force undefined parts
    (msg as Record<string, unknown>).parts = undefined;

    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual([{ type: 'text', text: '' }]);
  });

  it('adds default text part when parts is empty array', () => {
    const msg = makeMsg({ parts: [] });
    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual([{ type: 'text', text: '' }]);
  });

  it('filters out null/undefined parts', () => {
    const msg = makeMsg({
      parts: [
        null as unknown as UIMessage['parts'][number],
        { type: 'text', text: 'keep' },
        undefined as unknown as UIMessage['parts'][number],
      ],
    });
    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual([{ type: 'text', text: 'keep' }]);
  });

  it('replaces undefined text in text-type parts with empty string', () => {
    const msg = makeMsg({
      parts: [{ type: 'text' } as unknown as UIMessage['parts'][number]],
    });
    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual([{ type: 'text', text: '' }]);
  });

  it('preserves valid parts unchanged', () => {
    const parts: UIMessage['parts'] = [
      { type: 'text', text: 'hello' },
      { type: 'text', text: 'world' },
    ];
    const msg = makeMsg({ parts });
    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual(parts);
  });

  it('handles mix of valid and invalid parts', () => {
    const msg = makeMsg({
      parts: [
        null as unknown as UIMessage['parts'][number],
        { type: 'text', text: 'valid' },
        { type: 'text' } as unknown as UIMessage['parts'][number],
        undefined as unknown as UIMessage['parts'][number],
      ],
    });
    const [result] = sanitizeMessages([msg]);
    expect(result.parts).toEqual([
      { type: 'text', text: 'valid' },
      { type: 'text', text: '' },
    ]);
  });
});
