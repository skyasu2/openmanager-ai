import { filterResponse } from '../../security';
import { MALICIOUS_OUTPUT_PATTERNS } from '../../security-patterns';

const SAFE_MALICIOUS_OUTPUT =
  '죄송합니다. 해당 요청에 응답할 수 없습니다. 서버 모니터링 관련 질문을 해주세요.';
const SSE_FRAME_DELIMITER = '\n\n';
const MAX_PENDING_CHARS = 32 * 1024;
const RAW_MODEL_MARKER_PATTERN =
  /<\|(?:tool_call_begin|tool_call_end|tool_call|tool_result|tool_sep|assistant|system|user|end)[^|]*\|>/gi;
const STANDALONE_NOTHING_TO_PROCESS_PATTERN =
  /^\s*Nothing to process\.?\s*$/gim;
const REASONING_JSON_OBJECT_PATTERN =
  /\{\s*"reasoning"\s*:\s*"(?:(?:\\.)|[^"\\])*"(?:\s*,\s*"[^"]+"\s*:\s*(?:"(?:(?:\\.)|[^"\\])*"|[^,{}\n]+))*\s*\}/gi;

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

function containsRawModelArtifacts(text: string): boolean {
  RAW_MODEL_MARKER_PATTERN.lastIndex = 0;
  STANDALONE_NOTHING_TO_PROCESS_PATTERN.lastIndex = 0;
  REASONING_JSON_OBJECT_PATTERN.lastIndex = 0;
  const matched =
    RAW_MODEL_MARKER_PATTERN.test(text) ||
    STANDALONE_NOTHING_TO_PROCESS_PATTERN.test(text) ||
    REASONING_JSON_OBJECT_PATTERN.test(text);
  RAW_MODEL_MARKER_PATTERN.lastIndex = 0;
  STANDALONE_NOTHING_TO_PROCESS_PATTERN.lastIndex = 0;
  REASONING_JSON_OBJECT_PATTERN.lastIndex = 0;
  return matched;
}

function filterPlainContent(content: string): string {
  const withoutModelArtifacts = content
    .replace(RAW_MODEL_MARKER_PATTERN, '')
    .replace(REASONING_JSON_OBJECT_PATTERN, '')
    .replace(STANDALONE_NOTHING_TO_PROCESS_PATTERN, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const filtered = filterResponse(withoutModelArtifacts).filtered;
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
  const hasRawModelArtifacts = containsRawModelArtifacts(content);
  if (
    !initialFilter.wasFiltered &&
    !hasMaliciousOutput &&
    !hasRawModelArtifacts
  ) {
    return content;
  }

  try {
    return JSON.stringify(filterJsonValue(JSON.parse(content)));
  } catch {
    return hasMaliciousOutput
      ? SAFE_MALICIOUS_OUTPUT
      : filterPlainContent(content);
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
