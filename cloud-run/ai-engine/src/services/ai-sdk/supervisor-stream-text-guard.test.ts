import { describe, expect, it } from 'vitest';
import {
  createStructuredTextDeltaGuard,
  extractDisplayTextFromStructuredText,
  getRawToolCallNameFromText,
} from './supervisor-stream-text-guard';

describe('supervisor stream text guard', () => {
  it('buffers and suppresses chunked raw function-call JSON', () => {
    const guard = createStructuredTextDeltaGuard();

    expect(guard.push('{"type":"function",')).toEqual([]);
    expect(guard.push('"name":"analyzePattern",')).toEqual([]);
    expect(
      guard.push(
        '"arguments":{"query":"지난 1시간 동안 장애 징후가 있었던 구간만 요약해줘"}}'
      )
    ).toEqual([]);
    expect(guard.flush()).toEqual([]);
    expect(guard.hasRawToolCall()).toBe(true);
    expect(guard.getRawToolCallName()).toBe('analyzePattern');
  });

  it('extracts display text from structured answer JSON', () => {
    const guard = createStructuredTextDeltaGuard();

    expect(
      guard.push(
        '{"answer":"지난 1시간 동안 장애 징후는 1건입니다.","confidence":0.8}'
      )
    ).toEqual(['지난 1시간 동안 장애 징후는 1건입니다.']);
    expect(guard.hasRawToolCall()).toBe(false);
  });

  it('passes through normal text immediately', () => {
    const guard = createStructuredTextDeltaGuard();

    expect(guard.push('장애 징후는 확인되지 않았습니다.')).toEqual([
      '장애 징후는 확인되지 않았습니다.',
    ]);
    expect(guard.flush()).toEqual([]);
  });

  it('detects common raw tool-call payload shapes', () => {
    expect(
      getRawToolCallNameFromText(
        '{"type":"function","name":"analyzePattern","arguments":{"query":"q"}}'
      )
    ).toBe('analyzePattern');
    expect(
      getRawToolCallNameFromText(
        '{"tool_calls":[{"type":"function","function":{"name":"finalAnswer","arguments":{"answer":"ok"}}}]}'
      )
    ).toBe('finalAnswer');
  });

  it('does not classify ordinary JSON as a tool call', () => {
    const plainJson = '{"status":"ok","count":2}';

    expect(getRawToolCallNameFromText(plainJson)).toBeNull();
    expect(extractDisplayTextFromStructuredText(plainJson)).toBeNull();
  });
});
