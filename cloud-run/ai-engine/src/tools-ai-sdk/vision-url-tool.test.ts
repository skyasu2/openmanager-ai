import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { analyzeUrlContent } from './vision-url-tool';

const getInputSchema = () =>
  (
    analyzeUrlContent as unknown as {
      inputSchema: {
        parse: (input: unknown) => {
          url: string;
          extractSections?: string[];
          analysisGoal?: string;
        };
      };
    }
  ).inputSchema;

describe('analyzeUrlContent zod v4 schema contract', () => {
  it('runs on a zod v4 runtime with top-level URL format helpers', () => {
    const zodRuntime = z as unknown as {
      url?: unknown;
      email?: unknown;
      uuid?: unknown;
    };

    expect(zodRuntime.url).toBeTypeOf('function');
    expect(zodRuntime.email).toBeTypeOf('function');
    expect(zodRuntime.uuid).toBeTypeOf('function');
  });

  it('keeps URL validation strict after migrating to z.url()', () => {
    const inputSchema = getInputSchema();

    expect(() => inputSchema.parse({ url: 'not-a-url' })).toThrow();
    expect(
      inputSchema.parse({
        url: 'https://docs.example.com/install',
        extractSections: ['installation'],
        analysisGoal: 'Redis 설정 방법 찾기',
      })
    ).toEqual({
      url: 'https://docs.example.com/install',
      extractSections: ['installation'],
      analysisGoal: 'Redis 설정 방법 찾기',
    });
  });
});
