const STRUCTURED_TEXT_BUFFER_LIMIT = 8192;

type JsonRecord = Record<string, unknown>;

type TextBufferDecision =
  | { type: 'pending' }
  | { type: 'raw-text'; text: string }
  | { type: 'display-text'; text: string }
  | { type: 'raw-tool-call'; toolName: string | null };

export interface StructuredTextDeltaGuard {
  push(chunk: string): string[];
  flush(): string[];
  hasRawToolCall(): boolean;
  getRawToolCallName(): string | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function stripJsonCodeFence(text: string): string {
  const match = text
    .trim()
    .match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? text.trim();
}

function startsWithStructuredPayload(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('```');
}

function parseJsonRecord(text: string): JsonRecord | null {
  const normalized = stripJsonCodeFence(text);
  if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(normalized);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readFirstJsonObjectText(text: string): string | null {
  const normalized = stripJsonCodeFence(text);
  if (!normalized.startsWith('{')) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return normalized.slice(0, index + 1);
      }
    }
  }

  return null;
}

function parseFirstJsonRecord(text: string): JsonRecord | null {
  const firstObjectText = readFirstJsonObjectText(text);
  if (!firstObjectText) return null;

  try {
    const parsed: unknown = JSON.parse(firstObjectText);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasToolArguments(record: JsonRecord): boolean {
  return (
    'arguments' in record ||
    'args' in record ||
    'input' in record ||
    'parameters' in record
  );
}

function getRawToolCallName(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const type = getString(value.type)?.toLowerCase();
  const directName = getString(value.name) ?? getString(value.toolName);
  if (
    directName &&
    hasToolArguments(value) &&
    (!type ||
      type === 'function' ||
      type === 'tool_call' ||
      type === 'tool-call' ||
      type === 'tool')
  ) {
    return directName;
  }

  if (isRecord(value.function)) {
    const functionName = getString(value.function.name);
    if (functionName && hasToolArguments(value.function)) {
      return functionName;
    }
  }

  const toolCalls = Array.isArray(value.tool_calls)
    ? value.tool_calls
    : Array.isArray(value.toolCalls)
      ? value.toolCalls
      : [];
  for (const toolCall of toolCalls) {
    const toolName = getRawToolCallName(toolCall);
    if (toolName) return toolName;
  }

  return null;
}

export function getRawToolCallNameFromText(text: string): string | null {
  return getRawToolCallName(parseJsonRecord(text) ?? parseFirstJsonRecord(text));
}

export function extractDisplayTextFromStructuredText(
  text: string
): string | null {
  const parsed = parseJsonRecord(text);
  if (!parsed) return null;

  const answer = getString(parsed.answer);
  if (answer) return answer;

  const response = getString(parsed.response);
  if (response) return response;

  return null;
}

function classifyStructuredTextBuffer(
  buffer: string,
  final: boolean
): TextBufferDecision {
  if (!startsWithStructuredPayload(buffer)) {
    return { type: 'raw-text', text: buffer };
  }

  const parsed = parseJsonRecord(buffer);
  if (!parsed) {
    const rawToolCallName = getRawToolCallName(parseFirstJsonRecord(buffer));
    if (rawToolCallName) {
      return { type: 'raw-tool-call', toolName: rawToolCallName };
    }

    if (!final && buffer.length <= STRUCTURED_TEXT_BUFFER_LIMIT) {
      return { type: 'pending' };
    }
    return { type: 'raw-text', text: buffer };
  }

  const rawToolCallName = getRawToolCallName(parsed);
  if (rawToolCallName) {
    return { type: 'raw-tool-call', toolName: rawToolCallName };
  }

  const displayText = extractDisplayTextFromStructuredText(buffer);
  if (displayText) {
    return { type: 'display-text', text: displayText };
  }

  return { type: 'raw-text', text: buffer };
}

export function createStructuredTextDeltaGuard(): StructuredTextDeltaGuard {
  let buffering = false;
  let buffer = '';
  let rawToolCallName: string | null = null;

  const drainBuffer = (final: boolean): string[] => {
    if (!buffering) return [];

    const decision = classifyStructuredTextBuffer(buffer, final);
    if (decision.type === 'pending') return [];

    const bufferedText = buffer;
    buffer = '';
    buffering = false;

    if (decision.type === 'raw-tool-call') {
      rawToolCallName = decision.toolName;
      return [];
    }

    if (decision.type === 'display-text') {
      return [decision.text];
    }

    return [decision.text || bufferedText];
  };

  return {
    push(chunk: string): string[] {
      if (chunk.length === 0) return [];
      if (rawToolCallName !== null) return [];

      if (!buffering && startsWithStructuredPayload(chunk)) {
        buffering = true;
        buffer = chunk;
        return drainBuffer(false);
      }

      if (buffering) {
        buffer += chunk;
        return drainBuffer(false);
      }

      return [chunk];
    },

    flush(): string[] {
      return drainBuffer(true);
    },

    hasRawToolCall(): boolean {
      return rawToolCallName !== null;
    },

    getRawToolCallName(): string | null {
      return rawToolCallName;
    },
  };
}
