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
  /\{(?=[^{}\n]*"reasoning"\s*:)[^{}\n]*\}/gi;
const RAW_XML_TOOL_CALL_ARTIFACT_PATTERN =
  /<\/?(?:tool_call|arg_key|arg_value)\b/i;
const FINAL_ANSWER_TOOL_NAMES = new Set([
  'finalanswer',
  'final_answer',
  'final-answer',
]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeToolName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().toLowerCase();
}

function isFinalAnswerToolName(value: unknown): boolean {
  const normalized = normalizeToolName(value);
  return Boolean(normalized && FINAL_ANSWER_TOOL_NAMES.has(normalized));
}

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

function startsWithRawXmlToolCallPayload(text: string): boolean {
  return /^<tool_call(?:\s|>|\/)/i.test(text.trimStart());
}

function getRawXmlToolCallNameFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!startsWithRawXmlToolCallPayload(trimmed)) return null;

  const attrName = trimmed.match(
    /^<tool_call\b[^>]*(?:name|toolName|tool)=["']?([^"'\s>]+)["']?[^>]*>/i
  )?.[1];
  if (attrName) return attrName;

  return (
    trimmed.match(/^<tool_call(?:\s[^>]*)?>\s*([A-Za-z_][\w.-]*)/i)?.[1] ?? null
  );
}

function isAnswerBearingRawXmlToolCallName(toolName: string | null): boolean {
  if (!toolName) return false;
  return ['finalanswer', 'final_answer', 'final-answer'].includes(
    toolName.trim().toLowerCase()
  );
}

function containsRawXmlToolCallArtifacts(text: string): boolean {
  return RAW_XML_TOOL_CALL_ARTIFACT_PATTERN.test(text);
}

function extractRawXmlToolCallArgValue(text: string): string | null {
  const value = text.match(
    /<arg_value\b[^>]*>([\s\S]*?)<\/arg_value\s*>/i
  )?.[1];
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function filterRawXmlToolCallArtifacts(text: string): string {
  if (!containsRawXmlToolCallArtifacts(text)) {
    return text;
  }

  const toolName = getRawXmlToolCallNameFromText(text);
  if (startsWithRawXmlToolCallPayload(text)) {
    if (!isAnswerBearingRawXmlToolCallName(toolName)) {
      return '';
    }

    const completeArgValue = extractRawXmlToolCallArgValue(text);
    if (completeArgValue) {
      return completeArgValue;
    }
  }

  return text
    .replace(/^<tool_call(?:\s[^>]*)?>\s*final[-_]?answer\s*/i, '')
    .replace(/^([\s\S]*?)<arg_value\b[^>]*>/i, '')
    .replace(/<arg_key\b[^>]*>[\s\S]*?<\/arg_key\s*>/gi, '')
    .replace(/<\/?arg_value\b[^>]*>/gi, '')
    .replace(/<\/?tool_call\b[^>]*>/gi, '')
    .replace(/^\s*final[-_]?answer\s*$/i, '')
    .trim();
}

function filterPlainContent(content: string): string {
  const withoutRawXmlToolCalls = filterRawXmlToolCallArtifacts(content);
  const withoutModelArtifacts = withoutRawXmlToolCalls
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

function getPseudoToolName(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return (
    normalizeToolName(data.tool) ??
    normalizeToolName(data.name) ??
    normalizeToolName(data.toolName)
  );
}

function isFinalAnswerPseudoToolFrame(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.type !== 'string') return false;

  if (
    value.type === 'data-agent-step' ||
    value.type === 'data-tool-call' ||
    value.type === 'data-tool-result'
  ) {
    return isFinalAnswerToolName(getPseudoToolName(value.data));
  }

  return false;
}

function scrubFinalAnswerDoneData(value: unknown): unknown {
  if (!isRecord(value) || value.type !== 'data-done') {
    return value;
  }

  const data = isRecord(value.data) ? value.data : null;
  if (!data) return value;

  return {
    ...value,
    data: {
      ...data,
      ...(Array.isArray(data.toolsCalled)
        ? {
            toolsCalled: data.toolsCalled.filter(
              (toolName) => !isFinalAnswerToolName(toolName)
            ),
          }
        : {}),
    },
  };
}

function filterSseContent(content: string): string | null {
  if (!content.trim()) {
    return content;
  }

  const initialFilter = filterResponse(content);
  const hasMaliciousOutput = containsMaliciousOutput(initialFilter.filtered);
  const hasRawModelArtifacts = containsRawModelArtifacts(content);
  const hasRawXmlToolCallArtifacts = containsRawXmlToolCallArtifacts(content);
  const hasFinalAnswerPseudoToolArtifact = content.includes('finalAnswer');

  if (hasFinalAnswerPseudoToolArtifact) {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (isFinalAnswerPseudoToolFrame(parsed)) {
        return null;
      }
      const scrubbed = scrubFinalAnswerDoneData(parsed);
      if (scrubbed !== parsed) {
        return JSON.stringify(filterJsonValue(scrubbed));
      }
    } catch {
      // Fall through to the existing plain-text filter path.
    }
  }

  if (
    !initialFilter.wasFiltered &&
    !hasMaliciousOutput &&
    !hasRawModelArtifacts &&
    !hasRawXmlToolCallArtifacts
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

function filterSseLine(line: string): string | null {
  const match = line.match(/^((?:data|event|id|retry):\s?)(.*)$/);
  if (!match) {
    return filterPlainContent(line);
  }

  const prefix = match[1] ?? '';
  const content = match[2] ?? '';
  const filteredContent = filterSseContent(content);
  return filteredContent === null ? null : `${prefix}${filteredContent}`;
}

function filterFrame(frame: string): string | null {
  const filteredLines: string[] = [];
  for (const line of frame.split('\n')) {
    const filteredLine = filterSseLine(line);
    if (filteredLine === null) {
      return null;
    }
    filteredLines.push(filteredLine);
  }
  return filteredLines.join('\n');
}

function filterChunkText(text: string): string {
  if (!text) {
    return text;
  }

  const parts = text.split(SSE_FRAME_DELIMITER);
  const trailingFrame = parts.pop() ?? '';
  const filteredFrames = parts
    .map(filterFrame)
    .filter((frame): frame is string => frame !== null);
  const filteredTrailingFrame = filterFrame(trailingFrame);
  return `${filteredFrames.join(SSE_FRAME_DELIMITER)}${
    filteredFrames.length > 0 ? SSE_FRAME_DELIMITER : ''
  }${filteredTrailingFrame ?? ''}`;
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
