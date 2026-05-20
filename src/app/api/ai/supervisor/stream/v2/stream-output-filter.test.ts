import { describe, expect, it } from 'vitest';
import { createOutputFilterStream } from './stream-output-filter';

const encoder = new TextEncoder();

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function filterChunks(chunks: string[]): Promise<string> {
  const stream = createStream(chunks).pipeThrough(createOutputFilterStream());
  return new Response(stream).text();
}

function parseFirstDataPart(output: string): Record<string, unknown> {
  const dataLine = output.split('\n').find((line) => line.startsWith('data: '));

  expect(dataLine).toBeDefined();
  return JSON.parse(dataLine?.slice('data: '.length) ?? '{}');
}

describe('createOutputFilterStream', () => {
  it('removes dangerous script content inside streamed JSON data parts', async () => {
    const output = await filterChunks([
      `data: ${JSON.stringify({
        type: 'text-delta',
        delta: '<script>alert(1)</script>',
      })}\n\n`,
    ]);

    const dataPart = parseFirstDataPart(output);
    expect(dataPart.delta).toBe('[removed]');
    expect(output).not.toContain('<script>');
  });

  it('replaces leaked system prompt content with a safe response', async () => {
    const output = await filterChunks([
      `data: ${JSON.stringify({
        type: 'text-delta',
        delta: '당신은 서버 모니터링 AI 어시스턴트',
      })}\n\n`,
    ]);

    const dataPart = parseFirstDataPart(output);
    expect(dataPart.delta).toContain('서버 모니터링 관련 질문');
    expect(output).not.toContain('당신은 서버 모니터링 AI 어시스턴트');
  });

  it('removes raw tool-call markers and reasoning JSON before client rendering', async () => {
    const output = await filterChunks([
      `data: ${JSON.stringify({
        type: 'text-delta',
        delta:
          'Vercel BFF 설명\n<|tool_call_begin|>\nNothing to process.\n{"tool":"searchKnowledgeBase","reasoning":"hidden"}\n<|tool_call_end|>\nCloud Run 설명',
      })}\n\n`,
    ]);

    const dataPart = parseFirstDataPart(output);
    expect(dataPart.delta).toContain('Vercel BFF 설명');
    expect(dataPart.delta).toContain('Cloud Run 설명');
    expect(output).not.toContain('<|tool_call_begin|>');
    expect(output).not.toContain('Nothing to process');
    expect(output).not.toContain('"reasoning"');
  });

  it('passes through safe chunks without modification', async () => {
    const input = `data: ${JSON.stringify({
      type: 'text-delta',
      delta: 'CPU 사용률은 정상 범위입니다.',
    })}\n\n`;

    await expect(filterChunks([input])).resolves.toBe(input);
  });

  it('preserves SSE line prefixes while filtering only content', async () => {
    const output = await filterChunks([
      'event: message\n',
      'id: chunk-1\n',
      'data: <script>alert(1)</script>\n\n',
    ]);

    expect(output).toBe('event: message\nid: chunk-1\ndata: [removed]\n\n');
  });
});
