import type { DomainEvidenceRequest, DomainIntentFrame } from '../../core/assistant-runtime';
import type { QueryRankOrder } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  CONTEXTUAL_FOLLOW_UP_PATTERN,
  CONTEXTUAL_TOP_N_PATTERN,
  GROUP_TARGET_HINTS,
  HEALTHY_ONLY_EXCLUSION_PATTERN,
  HEALTHY_ONLY_PATTERN,
  MAX_CONTEXTUAL_SERVER_TARGETS,
  RANKED_SERVER_LINE_PATTERN,
  SERVER_COMPARISON_CONNECTOR_PATTERN,
  SERVER_ID_PATTERN,
  TIME_SERIES_COMPARISON_PATTERN,
} from './current-metrics-evidence-patterns';

export function normalizeRankCount(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? Math.min(value, 10)
    : 3;
}

function extractRankCountFromMessage(message: string): number | undefined {
  const match =
    message.match(/(?:상위|하위|top|bottom)\s*(\d{1,2})/i) ??
    message.match(/(\d{1,2})\s*(?:개|대|위)/);
  if (!match) return undefined;

  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10) : undefined;
}

export function normalizeCompositeLoadRankCount(message: string): number {
  const explicitCount = extractRankCountFromMessage(message);
  if (explicitCount !== undefined) return explicitCount;
  return /가장|최저|lowest|least/i.test(message) ? 1 : 3;
}

export function normalizeCompositePressureRankCount(message: string): number {
  const explicitCount = extractRankCountFromMessage(message);
  return explicitCount ?? 5;
}

export function isHealthyOnlyServerListMessage(message: string): boolean {
  return (
    HEALTHY_ONLY_PATTERN.test(message) &&
    !HEALTHY_ONLY_EXCLUSION_PATTERN.test(message)
  );
}

export function normalizeRankOrder(
  frame: DomainIntentFrame,
  message: string
): QueryRankOrder {
  return /하위|낮|최저|최소|안전|안정|bottom|lowest|least|asc|min/i.test(
    `${frame.aggregation ?? ''} ${message}`
  )
    ? 'asc'
    : 'desc';
}

export function normalizeTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((target): target is string => typeof target === 'string')
    .map((target) => target.trim())
    .filter((target) => target.length > 0);
}

function messageMentionsTarget(message: string, target: string): boolean {
  return message.toLowerCase().includes(target.toLowerCase());
}

export function inferGroupTargetFromMessage(message: string): string | undefined {
  return GROUP_TARGET_HINTS.find((hint) => hint.pattern.test(message))?.target;
}

export function extractGroupTargetsFromMessage(message: string): string[] {
  const indexedTargets = new Map<string, number>();
  for (const hint of GROUP_TARGET_HINTS) {
    const index = message.search(hint.pattern);
    if (index < 0 || indexedTargets.has(hint.target)) continue;
    indexedTargets.set(hint.target, index);
  }
  return Array.from(indexedTargets.entries())
    .sort((left, right) => left[1] - right[1])
    .map(([target]) => target);
}

export function extractServerIdTargetsFromMessage(message: string): string[] {
  const targets = new Set<string>();
  for (const match of message.matchAll(SERVER_ID_PATTERN)) {
    const serverId = match[0]?.toLowerCase();
    if (serverId) targets.add(serverId);
  }
  return Array.from(targets);
}

function extractRankedServerIdTargetsFromMessage(message: string): string[] {
  const targets = new Set<string>();
  for (const match of message.matchAll(RANKED_SERVER_LINE_PATTERN)) {
    const serverId = match[1]?.toLowerCase();
    if (serverId) targets.add(serverId);
  }
  return Array.from(targets);
}

function normalizeContextualTargetLimit(value: number): number | undefined {
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return Math.min(value, MAX_CONTEXTUAL_SERVER_TARGETS);
}

function inferContextualTopNLimit(message: string): number | undefined {
  const match = message.match(CONTEXTUAL_TOP_N_PATTERN);
  if (!match) return undefined;

  for (const rawValue of match.slice(1)) {
    if (!rawValue) continue;
    const limit = normalizeContextualTargetLimit(Number(rawValue));
    if (limit !== undefined) return limit;
  }

  return undefined;
}

function findPreviousUserMessageContent(
  messages: DomainEvidenceRequest['messages'],
  assistantIndex: number
): string {
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    const message = messages?.[index];
    if (message?.role === 'user') return message.content;
  }
  return '';
}

function isContextualFollowUpMessage(message: string): boolean {
  return CONTEXTUAL_FOLLOW_UP_PATTERN.test(message);
}

export function extractContextualServerTargetsFromMessages(
  request: DomainEvidenceRequest
): string[] {
  if (!isContextualFollowUpMessage(request.message)) return [];

  const messages = request.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    const rawTargets = extractServerIdTargetsFromMessage(message.content);
    if (rawTargets.length === 0) continue;

    const previousUserMessage = findPreviousUserMessageContent(messages, index);
    const topNLimit =
      inferContextualTopNLimit(previousUserMessage) ??
      inferContextualTopNLimit(message.content);
    const rankedTargets = extractRankedServerIdTargetsFromMessage(
      message.content
    );
    const sourceTargets =
      rankedTargets.length > 0 ? rankedTargets : rawTargets;
    const limit =
      topNLimit ??
      (rankedTargets.length > 0
        ? rankedTargets.length
        : MAX_CONTEXTUAL_SERVER_TARGETS);
    const targets = sourceTargets.slice(0, limit);
    if (targets.length > 0) return targets;
  }

  return [];
}

export function reconcileTargetsWithMessage(
  targets: string[],
  message: string
): string[] {
  const groupTarget = inferGroupTargetFromMessage(message);
  if (!groupTarget) return targets;

  const hasExplicitTargetMention = targets.some((target) =>
    messageMentionsTarget(message, target)
  );
  return hasExplicitTargetMention ? targets : [groupTarget];
}

export function isCurrentServerComparisonMessage(message: string): boolean {
  return (
    SERVER_COMPARISON_CONNECTOR_PATTERN.test(message) &&
    !TIME_SERIES_COMPARISON_PATTERN.test(message)
  );
}
