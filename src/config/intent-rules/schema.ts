import { z } from 'zod';

export const INTENT_PATTERN_NAMES = [
  'artifact_negation',
  'artifact_formatting_only',
  'artifact_explicit_execution',
  'artifact_how_to_request',
  'incident_report',
  'incident_report_action',
  'monitoring',
  'capacity_forecast_exclusion',
  'monitoring_action',
  'monitoring_artifact',
  'whole_system_monitoring',
  'ops_procedure_operational_context',
  'ops_procedure_shape',
  'ops_procedure_action',
  'ops_procedure_followup_edit',
  'llm_artifact_candidate',
  'llm_artifact_action_hint',
  'llm_artifact_shape',
  'future_time_reference',
] as const;

export type IntentPatternName = (typeof INTENT_PATTERN_NAMES)[number];

const ALLOWED_REGEX_FLAGS = /^(?!.*(.).*\1)[imsu]*$/;

type RegexScanFrame = {
  containsUnboundedQuantifier: boolean;
  currentBranchHasWildcardQuantifier: boolean;
  anyBranchHasWildcardQuantifier: boolean;
};

type QuantifierInfo = {
  length: number;
  repeatsMoreThanOnce: boolean;
  isUnbounded: boolean;
};

function isUnboundedQuantifier(char: string | undefined): boolean {
  return char === '*' || char === '+';
}

function readNumericQuantifier(
  source: string,
  startIndex: number
): QuantifierInfo | null {
  if (source[startIndex] !== '{') return null;

  const endIndex = source.indexOf('}', startIndex + 1);
  if (endIndex === -1) return null;

  const content = source.slice(startIndex + 1, endIndex);
  const match = content.match(/^(\d+)(?:,(\d*)?)?$/);
  if (!match?.[1]) return null;

  const min = Number.parseInt(match[1], 10);
  const hasComma = content.includes(',');
  const maxText = match[2];
  const max =
    hasComma && maxText === ''
      ? Number.POSITIVE_INFINITY
      : maxText
        ? Number.parseInt(maxText, 10)
        : min;

  return {
    length: endIndex - startIndex + 1,
    repeatsMoreThanOnce: Number.isFinite(max) ? max > 1 : true,
    isUnbounded: max === Number.POSITIVE_INFINITY,
  };
}

function readQuantifier(source: string, startIndex: number): QuantifierInfo {
  const char = source[startIndex];
  if (char === '*' || char === '+') {
    return {
      length: 1,
      repeatsMoreThanOnce: true,
      isUnbounded: true,
    };
  }
  if (char === '?') {
    return {
      length: 1,
      repeatsMoreThanOnce: false,
      isUnbounded: false,
    };
  }

  return (
    readNumericQuantifier(source, startIndex) ?? {
      length: 0,
      repeatsMoreThanOnce: false,
      isUnbounded: false,
    }
  );
}

function hasWildcardQuantifier(frame: RegexScanFrame): boolean {
  return (
    frame.currentBranchHasWildcardQuantifier ||
    frame.anyBranchHasWildcardQuantifier
  );
}

function findMatchingGroupEnd(source: string, openIndex: number): number {
  let depth = 0;
  let inCharacterClass = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];

    if (char === '\\') {
      index += 1;
      continue;
    }

    if (inCharacterClass) {
      if (char === ']') {
        inCharacterClass = false;
      }
      continue;
    }

    if (char === '[') {
      inCharacterClass = true;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function splitTopLevelAlternatives(content: string): string[] {
  const alternatives: string[] = [];
  let start = 0;
  let depth = 0;
  let inCharacterClass = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '\\') {
      index += 1;
      continue;
    }

    if (inCharacterClass) {
      if (char === ']') {
        inCharacterClass = false;
      }
      continue;
    }

    if (char === '[') {
      inCharacterClass = true;
      continue;
    }

    if (char === '(') {
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      continue;
    }

    if (char === '|' && depth === 0) {
      alternatives.push(content.slice(start, index));
      start = index + 1;
    }
  }

  alternatives.push(content.slice(start));
  return alternatives;
}

function normalizeLiteralAlternative(alternative: string): string | null {
  let literal = '';

  for (let index = 0; index < alternative.length; index += 1) {
    const char = alternative[index];
    if (!char) return null;

    if (char === '\\') {
      const next = alternative[index + 1];
      if (!next || /[dDsSwWbB]/.test(next)) return null;
      literal += next;
      index += 1;
      continue;
    }

    if (/[.^$*+?()[\]{}|]/.test(char)) {
      return null;
    }

    literal += char;
  }

  return literal.length > 0 ? literal : null;
}

function hasPrefixOverlap(alternatives: string[]): boolean {
  const literals = alternatives
    .map((alternative) => normalizeLiteralAlternative(alternative))
    .filter((literal): literal is string => Boolean(literal));

  if (literals.length !== alternatives.length) return false;

  for (let left = 0; left < literals.length; left += 1) {
    for (let right = 0; right < literals.length; right += 1) {
      if (left === right) continue;
      const leftValue = literals[left];
      const rightValue = literals[right];
      if (!leftValue || !rightValue) continue;
      if (rightValue.startsWith(leftValue)) return true;
    }
  }

  return false;
}

function hasAmbiguousQuantifiedAlternation(source: string): boolean {
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '\\') {
      index += 1;
      continue;
    }

    if (char !== '(') continue;

    const groupEnd = findMatchingGroupEnd(source, index);
    if (groupEnd === -1) continue;

    const quantifier = readQuantifier(source, groupEnd + 1);
    if (!quantifier.repeatsMoreThanOnce) {
      index = groupEnd;
      continue;
    }

    let content = source.slice(index + 1, groupEnd);
    if (content.startsWith('?:')) {
      content = content.slice(2);
    }

    const alternatives = splitTopLevelAlternatives(content);
    if (alternatives.length > 1 && hasPrefixOverlap(alternatives)) {
      return true;
    }

    index = groupEnd + Math.max(quantifier.length - 1, 0);
  }

  return false;
}

function hasPotentialNestedQuantifier(source: string): boolean {
  const stack: RegexScanFrame[] = [
    {
      containsUnboundedQuantifier: false,
      currentBranchHasWildcardQuantifier: false,
      anyBranchHasWildcardQuantifier: false,
    },
  ];
  let inCharacterClass = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '\\') {
      index += 1;
      continue;
    }

    if (inCharacterClass) {
      if (char === ']') {
        inCharacterClass = false;
      }
      continue;
    }

    if (char === '[') {
      inCharacterClass = true;
      continue;
    }

    const current = stack[stack.length - 1];
    if (!current) return false;

    if (char === '|') {
      current.anyBranchHasWildcardQuantifier =
        current.anyBranchHasWildcardQuantifier ||
        current.currentBranchHasWildcardQuantifier;
      current.currentBranchHasWildcardQuantifier = false;
      continue;
    }

    if (char === '(') {
      stack.push({
        containsUnboundedQuantifier: false,
        currentBranchHasWildcardQuantifier: false,
        anyBranchHasWildcardQuantifier: false,
      });
      continue;
    }

    if (char === ')') {
      const group = stack.pop();
      const parent = stack[stack.length - 1];
      if (!group || !parent) continue;

      const groupHasWildcardQuantifier = hasWildcardQuantifier(group);
      const quantifier = readQuantifier(source, index + 1);
      if (
        group.containsUnboundedQuantifier &&
        quantifier.repeatsMoreThanOnce
      ) {
        return true;
      }

      if (
        groupHasWildcardQuantifier &&
        quantifier.repeatsMoreThanOnce
      ) {
        return true;
      }

      if (
        parent.currentBranchHasWildcardQuantifier &&
        groupHasWildcardQuantifier
      ) {
        return true;
      }

      parent.containsUnboundedQuantifier =
        parent.containsUnboundedQuantifier ||
        group.containsUnboundedQuantifier ||
        quantifier.isUnbounded;
      parent.currentBranchHasWildcardQuantifier =
        parent.currentBranchHasWildcardQuantifier || groupHasWildcardQuantifier;

      if (quantifier.length > 0) {
        index += quantifier.length;
      }
      continue;
    }

    if (char === '.') {
      const quantifier = readQuantifier(source, index + 1);
      if (!quantifier.isUnbounded) {
        continue;
      }
      if (current.currentBranchHasWildcardQuantifier) {
        return true;
      }
      current.containsUnboundedQuantifier = true;
      current.currentBranchHasWildcardQuantifier = true;
      index += quantifier.length;
      continue;
    }

    if (isUnboundedQuantifier(char)) {
      if (isUnboundedQuantifier(source[index - 1])) {
        return true;
      }
      current.containsUnboundedQuantifier = true;
      continue;
    }

    const quantifier = readNumericQuantifier(source, index);
    if (quantifier?.isUnbounded) {
      current.containsUnboundedQuantifier = true;
      index += quantifier.length - 1;
    }
  }

  return hasAmbiguousQuantifiedAlternation(source);
}

export const IntentPatternEntrySchema = z
  .object({
    source: z.string().min(1),
    flags: z.string().regex(ALLOWED_REGEX_FLAGS),
    description: z.string().min(1),
    examples: z.array(z.string()).default([]),
    counterExamples: z.array(z.string()).default([]),
  })
  .strict()
  .superRefine((entry, ctx) => {
    try {
      new RegExp(entry.source, entry.flags);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: `invalid regex: ${String(error)}`,
        path: ['source'],
      });
    }

    if (hasPotentialNestedQuantifier(entry.source)) {
      ctx.addIssue({
        code: 'custom',
        message: 'potential ReDoS pattern: nested quantifier',
        path: ['source'],
      });
    }
  });

const IntentPatternEntriesSchema = z.object(
  Object.fromEntries(
    INTENT_PATTERN_NAMES.map((name) => [name, IntentPatternEntrySchema])
  ) as Record<IntentPatternName, typeof IntentPatternEntrySchema>
).strict();

export const IntentPatternsSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.string().min(1),
    lastUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ruleVersion: z.literal('bff'),
    patterns: IntentPatternEntriesSchema,
  })
  .strict();

export type IntentPatternsConfig = z.infer<typeof IntentPatternsSchema>;
export type IntentPatternEntry = z.infer<typeof IntentPatternEntrySchema>;
