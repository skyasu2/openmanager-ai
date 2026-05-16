import { filterResponse } from '../../security';
import { MALICIOUS_OUTPUT_PATTERNS } from '../../security-patterns';

const SAFE_MALICIOUS_OUTPUT =
  '죄송합니다. 해당 요청에 응답할 수 없습니다. 서버 모니터링 관련 질문을 해주세요.';
const SSE_FRAME_DELIMITER = '\n\n';
const MAX_PENDING_CHARS = 32 * 1024;

function containsMaliciousOutput(text: string): boolean {
  for (const { pattern } of MALICIOUS_OUTPUT_PATTERNS) {
    pattern.lastIndex = 0;
    const matched = pattern.test(text);
    pattern.lastIndex = 0;
    if (matched) {
      return true;
    }
  }
  return false;
}

function filterPlainContent(content: string): string {
  const filtered = filterResponse(content).filtered;
  return containsMaliciousOutput(filtered) ? SAFE_MALICIOUS_OUTPUT : filtered;
}

function filterJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return filterPlainContent(value);
  }
  if (Array.isArray(value)) {
    return value.map(filterJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, filterJsonValue(entry)])
    );
  }
  return value;
}

function filterSseContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  const initialFilter = filterResponse(content);
  const hasMaliciousOutput = containsMaliciousOutput(initialFilter.filtered);
  if (!initialFilter.wasFiltered && !hasMaliciousOutput) {
    return content;
  }

  try {
    return JSON.stringify(filterJsonValue(JSON.parse(content)));
  } catch {
    return hasMaliciousOutput ? SAFE_MALICIOUS_OUTPUT : initialFilter.filtered;
  }
}

function filterSseLine(line: string): string {
  const match = line.match(/^((?:data|event|id|retry):\s?)(.*)$/);
  if (!match) {
    return filterPlainContent(line);
  }

  const prefix = match[1] ?? '';
  const content = match[2] ?? '';
  return `${prefix}${filterSseContent(content)}`;
}

function filterFrame(frame: string): string {
  return frame.split('\n').map(filterSseLine).join('\n');
}

function filterChunkText(text: string): string {
  if (!text) {
    return text;
  }

  const parts = text.split(SSE_FRAME_DELIMITER);
  const trailingFrame = parts.pop() ?? '';
  const filteredFrames = parts.map(filterFrame);
  return `${filteredFrames.join(SSE_FRAME_DELIMITER)}${
    filteredFrames.length > 0 ? SSE_FRAME_DELIMITER : ''
  }${filterFrame(trailingFrame)}`;
}

export function createOutputFilterStream(): TransformStream<
  Uint8Array,
  Uint8Array
> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true });

      if (!pending.includes(SSE_FRAME_DELIMITER)) {
        if (pending.length > MAX_PENDING_CHARS) {
          controller.enqueue(encoder.encode(filterChunkText(pending)));
          pending = '';
        }
        return;
      }

      const parts = pending.split(SSE_FRAME_DELIMITER);
      pending = parts.pop() ?? '';
      const completeFrames = parts.map(filterFrame).join(SSE_FRAME_DELIMITER);
      controller.enqueue(
        encoder.encode(`${completeFrames}${SSE_FRAME_DELIMITER}`)
      );
    },
    flush(controller) {
      const rest = decoder.decode();
      if (rest) {
        pending += rest;
      }
      if (pending) {
        controller.enqueue(encoder.encode(filterChunkText(pending)));
      }
    },
  });
}
