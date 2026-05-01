import { describe, expect, it } from 'vitest';

import { finalAnswer } from './final-answer';

const getInputSchema = () =>
  (
    finalAnswer as unknown as {
      inputSchema: { parse: (input: unknown) => Record<string, unknown> };
    }
  ).inputSchema;

describe('finalAnswer', () => {
  it('accepts toolsUsed as a JSON string array from tool-call payloads', async () => {
    const parsed = getInputSchema().parse({
      answer: '장애 의심 서버 2대를 확인했습니다.',
      toolsUsed: '["analyzePattern","getServerMetrics"]',
    });

    expect(parsed.toolsUsed).toEqual(['analyzePattern', 'getServerMetrics']);

    const result = await finalAnswer.execute(parsed as never);

    expect(result.toolsUsed).toEqual(['analyzePattern', 'getServerMetrics']);
    expect(result.confidence).toBe(0.8);
  });

  it('accepts toolsUsed as a comma-separated string from relaxed model outputs', async () => {
    const parsed = getInputSchema().parse({
      answer: '분석 완료',
      confidence: 0.92,
      toolsUsed: 'detectAnomalies, finalAnswer',
    });

    const result = await finalAnswer.execute(parsed as never);

    expect(result.toolsUsed).toEqual(['detectAnomalies', 'finalAnswer']);
    expect(result.confidence).toBe(0.92);
  });
});
