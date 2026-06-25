export const AI_QA_CORRELATION_STORAGE_KEY = 'openmanager.ai.qaCorrelation';

export interface AiQaCorrelationMetadata {
  qaRunId?: string;
  qaTestCaseId?: string;
  qaSource?: string;
}

type QaCorrelationInput = {
  qaRunId?: unknown;
  runId?: unknown;
  qaTestCaseId?: unknown;
  testCaseId?: unknown;
  qaSource?: unknown;
  source?: unknown;
};

const SAFE_QA_VALUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/@#=+\-\s]{0,127}$/u;

function isRecord(value: unknown): value is QaCorrelationInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeQaValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 128) return undefined;
  if (!SAFE_QA_VALUE_PATTERN.test(trimmed)) return undefined;

  return trimmed;
}

export function normalizeAiQaCorrelationMetadata(
  value: unknown
): AiQaCorrelationMetadata | undefined {
  if (!isRecord(value)) return undefined;

  const qaRunId = normalizeQaValue(value.qaRunId ?? value.runId);
  const qaTestCaseId = normalizeQaValue(value.qaTestCaseId ?? value.testCaseId);
  const qaSource = normalizeQaValue(value.qaSource ?? value.source);
  const metadata: AiQaCorrelationMetadata = {
    ...(qaRunId && { qaRunId }),
    ...(qaTestCaseId && { qaTestCaseId }),
    ...(qaSource && { qaSource }),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
