/**
 * Calculation Tools (AI SDK Format)
 *
 * Safe, deterministic 수치 계산 도구. 사용자 요청을 바탕으로
 * 수식 계산, 통계 계산, 간단한 용량 계획 시뮬레이션을 제공합니다.
 *
 * 핵심 원칙:
 * - eval 사용 금지 (직접 파싱/AST 평가)
 * - 결과는 고정 정밀도 반올림 적용
 * - 예측 가능한 실패 코드 제공
 */

import { tool } from 'ai';
import { z } from 'zod';

import { logger } from '../lib/logger';

// ----------------------------------------------------------------------------
// 내부 파서 타입
// ----------------------------------------------------------------------------

type TokenType = 'number' | 'identifier' | 'operator' | 'paren' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

const MAX_EXPRESSION_LENGTH = 400;
const MAX_VALUES_COUNT = 1000;
const MAX_EXPRESSION_DECIMALS = 12;

const EXPR_REGEX = {
  numberStart: /[0-9.]/,
  number: /[0-9.]/,
  identifier: /[a-zA-Z_]/,
  identifierContinue: /[a-zA-Z0-9_]/,
};

// ----------------------------------------------------------------------------
// 토크나이저
// ----------------------------------------------------------------------------

function tokenizeExpression(expression: string): Token[] {
  const input = expression.trim();
  if (input.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`TOOL_EXECUTION_FAILED: 수식 길이가 너무 깁니다 (max ${MAX_EXPRESSION_LENGTH}자)`);
  }

  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const ch = input[index];

    if (/\s/.test(ch)) {
      index += 1;
      continue;
    }

    if (EXPR_REGEX.numberStart.test(ch)) {
      const start = index;
      let hasDot = false;

      while (index < input.length && EXPR_REGEX.number.test(input[index])) {
        if (input[index] === '.') {
          if (hasDot) {
            throw new Error('TOOL_EXECUTION_FAILED: 숫자 표기 오류 (소수점 중복)');
          }
          hasDot = true;
        }
      index += 1;
      }

      const raw = input.slice(start, index);
      if (raw === '.' || Number.isNaN(Number(raw))) {
        throw new Error('TOOL_EXECUTION_FAILED: 잘못된 숫자 표기');
      }

      tokens.push({ type: 'number', value: raw, position: start });
      continue;
    }

    if (EXPR_REGEX.identifier.test(ch)) {
      const start = index;
      index += 1;
      while (index < input.length && EXPR_REGEX.identifierContinue.test(input[index])) {
        index += 1;
      }
      tokens.push({
        type: 'identifier',
        value: input.slice(start, index).toLowerCase(),
        position: start,
      });
      continue;
    }

    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push({
        type: ch === ',' ? 'comma' : 'paren',
        value: ch,
        position: index,
      });
      index += 1;
      continue;
    }

    if (['+', '-', '*', '/', '^', '%'].includes(ch)) {
      tokens.push({ type: 'operator', value: ch, position: index });
      index += 1;
      continue;
    }

    throw new Error(`TOOL_EXECUTION_FAILED: 허용되지 않는 문자 "${ch}"`);
  }

  tokens.push({ type: 'eof', value: '', position: input.length });
  return tokens;
}

// ----------------------------------------------------------------------------
// 안전한 식 파서 (재귀 하강 파서)
// ----------------------------------------------------------------------------

class ExpressionParser {
  private readonly tokens: Token[];
  private readonly source: string;
  private index = 0;

  constructor(expression: string) {
    this.source = expression;
    this.tokens = tokenizeExpression(expression);
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.peek().type !== 'eof') {
      throw new Error(`TOOL_EXECUTION_FAILED: 파싱 불완전 (${this.describeToken(this.peek())})`);
    }
    return value;
  }

  private parseExpression(): number {
    return this.parseAdditive();
  }

  // 덧셈/뺄셈
  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      left = operator === '+' ? left + right : left - right;
    }

    return left;
  }

  // 곱셈/나눗셈
  private parseMultiplicative(): number {
    let left = this.parsePower();
    while (this.matchOperator('*') || this.matchOperator('/')) {
      const operator = this.consume().value;
      const right = this.parsePower();
      if (operator === '/' && right === 0) {
        throw new Error('TOOL_EXECUTION_FAILED: 0으로 나눌 수 없습니다');
      }
      left = operator === '*' ? left * right : left / right;
    }
    return left;
  }

  // 지수 (우결합)
  private parsePower(): number {
    let left = this.parseUnary();
    if (this.matchOperator('^')) {
      this.consume();
      const right = this.parsePower();
      left = Math.pow(left, right);
    }
    return left;
  }

  // 단항 +, -, percent(%) postfix, 함수/괄호
  private parseUnary(): number {
    if (this.matchOperator('+')) {
      this.consume();
      return this.parseUnary();
    }

    if (this.matchOperator('-')) {
      this.consume();
      return -this.parseUnary();
    }

    let value = this.parsePrimary();

    if (this.matchOperator('%')) {
      this.consume();
      value /= 100;
    }

    return value;
  }

  private parsePrimary(): number {
    const token = this.peek();

    if (token.type === 'number') {
      this.consume();
      return Number(token.value);
    }

    if (token.type === 'identifier') {
      return this.parseIdentifierOrConstant();
    }

    if (this.matchParen('(')) {
      this.consume();
      const value = this.parseExpression();
      if (!this.matchParen(')')) {
        throw new Error('TOOL_EXECUTION_FAILED: 닫는 괄호가 없습니다');
      }
      this.consume();
      return value;
    }

    throw new Error(`TOOL_EXECUTION_FAILED: 예기치 않은 토큰 ${this.describeToken(token)}`);
  }

  private parseIdentifierOrConstant(): number {
    const token = this.consume();
    const identifier = token.value;
    const constants = {
      pi: Math.PI,
      e: Math.E,
    } as const;

    if (identifier in constants) {
      return constants[identifier as keyof typeof constants];
    }

    // function call
    if (!this.matchParen('(')) {
      throw new Error(`TOOL_EXECUTION_FAILED: 미지원 식별자 "${identifier}"`);
    }

    this.consume(); // (
    const args: number[] = [];

    if (!this.matchParen(')')) {
      args.push(this.parseExpression());
      while (this.matchCommaOnly()) {
        this.consume();
        args.push(this.parseExpression());
      }
    }

    if (!this.matchParen(')')) {
      throw new Error(`TOOL_EXECUTION_FAILED: "${identifier}(...)"의 닫는 괄호가 없습니다`);
    }
    this.consume();

    return this.evaluateMathFunction(identifier, args, token.position);
  }

  private evaluateMathFunction(name: string, args: number[], position: number): number {
    const first = args[0];
    const second = args[1];

    switch (name) {
      case 'sqrt':
        if (args.length !== 1) {
          throw new Error(`TOOL_EXECUTION_FAILED: sqrt는 1개 인자만 허용됩니다 (${position})`);
        }
        if (first < 0) {
          throw new Error('TOOL_EXECUTION_FAILED: sqrt는 음수 값에 대해 사용할 수 없습니다');
        }
        return Math.sqrt(first);

      case 'abs':
        if (args.length !== 1) {
          throw new Error('TOOL_EXECUTION_FAILED: abs는 1개 인자만 허용됩니다');
        }
        return Math.abs(first);

      case 'floor':
      case 'ceil':
      case 'round':
        if (args.length !== 1) {
          throw new Error(`TOOL_EXECUTION_FAILED: ${name}는 1개 인자만 허용됩니다`);
        }
        if (name === 'floor') return Math.floor(first);
        if (name === 'ceil') return Math.ceil(first);
        return Math.round(first);

      case 'ln':
      case 'log':
        if (args.length !== 1 && !(name === 'log' && args.length === 2)) {
          throw new Error(`TOOL_EXECUTION_FAILED: ${name}는 1개 또는 2개 인자만 허용됩니다`);
        }
        if (name === 'ln') {
          if (first <= 0) {
            throw new Error('TOOL_EXECUTION_FAILED: ln은 0 이하에 대해 정의되지 않습니다');
          }
          return Math.log(first);
        }

        if (args.length === 1) {
          return Math.log10(first);
        }
        if (second <= 0 || first <= 0) {
          throw new Error('TOOL_EXECUTION_FAILED: log(a, b)는 a, b가 0보다 커야 합니다');
        }
        return Math.log(first) / Math.log(second);

      case 'sin':
      case 'cos':
      case 'tan':
        if (args.length !== 1) {
          throw new Error(`TOOL_EXECUTION_FAILED: ${name}은 1개 인자만 허용됩니다`);
        }
        if (name === 'sin') return Math.sin(first);
        if (name === 'cos') return Math.cos(first);
        return Math.tan(first);

      case 'min':
      case 'max':
        if (args.length === 0) {
          throw new Error(`TOOL_EXECUTION_FAILED: ${name}는 최소 1개 인자가 필요합니다`);
        }
        return name === 'min' ? Math.min(...args) : Math.max(...args);

      case 'pow':
        if (args.length !== 2) {
          throw new Error('TOOL_EXECUTION_FAILED: pow는 2개 인자만 허용됩니다');
        }
        return Math.pow(first, second);

      case 'exp':
        if (args.length !== 1) {
          throw new Error('TOOL_EXECUTION_FAILED: exp는 1개 인자만 허용됩니다');
        }
        return Math.exp(first);

      default:
        throw new Error(`TOOL_EXECUTION_FAILED: 미지원 함수 "${name}"`);
    }
  }

  private matchOperator(operator: string): boolean {
    const token = this.peek();
    return token.type === 'operator' && token.value === operator;
  }

  private matchParen(value: '(' | ')'): boolean {
    return this.peek().type === 'paren' && this.peek().value === value;
  }

  private matchCommaOnly(): boolean {
    return this.peek().type === 'comma';
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private consume(): Token {
    const token = this.tokens[this.index];
    if (!token || token.type === 'eof') {
      return { type: 'eof', value: '', position: this.source.length };
    }
    this.index += 1;
    return token;
  }

  private describeToken(token: Token): string {
    if (token.type === 'eof') {
      return 'EOF';
    }
    return `"${token.value}" at ${token.position}`;
  }
}

function roundToPrecision(value: number, precision: number): number {
  const safePrecision = Math.min(Math.max(Math.trunc(precision), 0), MAX_EXPRESSION_DECIMALS);
  const factor = 10 ** safePrecision;
  return Math.round(value * factor) / factor;
}

function sortCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function computePercentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) {
    throw new Error('TOOL_EXECUTION_FAILED: 백분위 계산용 값이 없습니다');
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const idx = (sortedValues.length - 1) * p;
  const left = Math.floor(idx);
  const right = Math.ceil(idx);

  if (left === right) {
    return sortedValues[left];
  }

  const weight = idx - left;
  return sortedValues[left] + (sortedValues[right] - sortedValues[left]) * weight;
}

// ----------------------------------------------------------------------------
// Tool: evaluateMathExpression
// ----------------------------------------------------------------------------

export interface MathExpressionResult {
  success: boolean;
  expression: string;
  result: number;
  precision: number;
  status: 'success' | 'error';
}

export const evaluateMathExpression = tool({
  description:
    '수학 수식(사칙연산, 괄호, 지수, 상수, 함수)을 안전하게 계산합니다. 허용 함수: sqrt, abs, floor, ceil, round, ln, log, exp, sin, cos, tan, min, max, pow.',
  inputSchema: z.object({
    expression: z
      .string()
      .min(1)
      .max(MAX_EXPRESSION_LENGTH)
      .describe('계산할 수식. 예: "sqrt(81) + 20% * 1.2 ^ 2"'),
    precision: z
      .number()
      .int()
      .min(0)
      .max(MAX_EXPRESSION_DECIMALS)
      .optional()
      .describe('반올림 소수점 자릿수'),
  }),
  execute: async ({
    expression,
    precision = 6,
  }: {
    expression: string;
    precision?: number;
  }): Promise<MathExpressionResult | { success: false; status: 'error'; expression: string; error: string; systemMessage: string; suggestedAgentAction: string }> => {
    const normalizedExpression = expression.trim();

    try {
      const parser = new ExpressionParser(normalizedExpression);
      const value = parser.parse();
      if (!Number.isFinite(value)) {
        throw new Error('TOOL_EXECUTION_FAILED: 계산 결과가 유효하지 않습니다');
      }

      const rounded = roundToPrecision(value, precision);
      logger.info(`[evaluateMathExpression] success expression="${normalizedExpression}" precision=${precision}`);

      return {
        success: true,
        expression: normalizedExpression,
        result: rounded,
        precision,
        status: 'success',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[evaluateMathExpression] failed expression="${normalizedExpression}" message=${message}`);
      return {
        success: false,
        status: 'error',
        expression: normalizedExpression,
        error: message,
        systemMessage: `TOOL_EXECUTION_FAILED: 수식 계산 실행 실패 (${message})`,
        suggestedAgentAction: '수식 문법(연산자  + - * / ^, 괄호, 함수)과 숫자 범위를 점검하고, 허용 함수만 사용해 재요청하세요.',
      };
    }
  },
});

// ----------------------------------------------------------------------------
// Tool: computeSeriesStats
// ----------------------------------------------------------------------------

export interface SeriesStatsResult {
  success: boolean;
  count: number;
  precision: number;
  statistics: {
    min: number;
    max: number;
    sum: number;
    mean: number;
    median: number;
    range: number;
    variance: number;
    standardDeviation: number;
    p25: number;
    p75: number;
    p95: number;
  };
}

export const computeSeriesStats = tool({
  description: '숫자 배열의 통계를 계산합니다. count/sum/평균/중앙값/분산/표준편차/백분위수(p25,p75,p95)를 제공합니다.',
  inputSchema: z.object({
    values: z
      .array(z.number())
      .min(1)
      .max(MAX_VALUES_COUNT)
      .describe('통계 계산 대상 숫자 배열, 예: [10, 20, 30, 40]'),
    precision: z
      .number()
      .int()
      .min(0)
      .max(MAX_EXPRESSION_DECIMALS)
      .optional()
      .describe('반올림 소수점 자릿수'),
  }),
  execute: async ({
    values,
    precision = 4,
  }: {
    values: number[];
    precision?: number;
  }): Promise<SeriesStatsResult | { success: false; status?: undefined; error: string }> => {
    const safePrecision = Math.min(Math.max(Math.trunc(precision), 0), MAX_EXPRESSION_DECIMALS);

    try {
      if (values.some((value) => !Number.isFinite(value))) {
        throw new Error('TOOL_EXECUTION_FAILED: values에는 유한한 숫자만 허용됩니다');
      }
      if (values.length > MAX_VALUES_COUNT) {
        throw new Error(`TOOL_EXECUTION_FAILED: values 길이가 너무 깁니다 (max ${MAX_VALUES_COUNT})`);
      }

      const count = values.length;
      const copy = sortCopy(values);
      const min = copy[0];
      const max = copy[copy.length - 1];
      const sum = values.reduce((acc, value) => acc + value, 0);
      const mean = sum / count;
      const mid = Math.floor(count / 2);
      const median = count % 2 === 0 ? (copy[mid - 1] + copy[mid]) / 2 : copy[mid];
      const variance =
        values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / count;
      const standardDeviation = Math.sqrt(variance);
      const range = max - min;

      const stats = {
        min: roundToPrecision(min, safePrecision),
        max: roundToPrecision(max, safePrecision),
        sum: roundToPrecision(sum, safePrecision),
        mean: roundToPrecision(mean, safePrecision),
        median: roundToPrecision(median, safePrecision),
        range: roundToPrecision(range, safePrecision),
        variance: roundToPrecision(variance, safePrecision),
        standardDeviation: roundToPrecision(standardDeviation, safePrecision),
        p25: roundToPrecision(computePercentile(copy, 0.25), safePrecision),
        p75: roundToPrecision(computePercentile(copy, 0.75), safePrecision),
        p95: roundToPrecision(computePercentile(copy, 0.95), safePrecision),
      };

      logger.info(`[computeSeriesStats] count=${count} precision=${safePrecision}`);

      return {
        success: true,
        count,
        precision: safePrecision,
        statistics: stats,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[computeSeriesStats] failed: ${message}`);
      return {
        success: false,
        error: `TOOL_EXECUTION_FAILED: ${message}`,
      };
    }
  },
});

// ----------------------------------------------------------------------------
// Tool: estimateCapacityProjection
// ----------------------------------------------------------------------------

export interface CapacityProjectionResult {
  success: boolean;
  currentLoad: number;
  targetCapacity: number;
  safeCapacity: number;
  growthRatePercent: number;
  forecastPeriods: number;
  headroomPercent: number;
  projectedPeakLoad: number;
  utilizationPercentAtForecastEnd: number;
  saturationPeriod: number | null;
  recommendation: string;
}

export const estimateCapacityProjection = tool({
  description: '지수 성장 가정 기반으로 기간별 peak load를 시뮬레이션해 임계치 돌파 시점을 추정합니다.',
  inputSchema: z.object({
    currentLoad: z.number().min(0).describe('현재 peak 지표(예: CPU 85, 요청량 1200)'),
    targetCapacity: z.number().min(0.0001).describe('안전 여유치 기준이 되는 총 용량'),
    growthRatePercent: z.number().describe('기간당 증감률(%)'),
    forecastPeriods: z
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30)
      .describe('예측 기간(기본 30)'),
    headroomPercent: z
      .number()
      .min(0)
      .max(90)
      .default(20)
      .describe('유지해야 할 안전 여유비율'),
    precision: z
      .number()
      .int()
      .min(0)
      .max(MAX_EXPRESSION_DECIMALS)
      .optional()
      .describe('반올림 소수점 자릿수'),
  }),
  execute: async ({
    currentLoad,
    targetCapacity,
    growthRatePercent,
    forecastPeriods,
    headroomPercent = 20,
    precision = 2,
  }: {
    currentLoad: number;
    targetCapacity: number;
    growthRatePercent: number;
    forecastPeriods: number;
    headroomPercent?: number;
    precision?: number;
  }): Promise<
    CapacityProjectionResult | { success: false; error: string; recommendation: string }
  > => {
    const safePrecision = Math.min(Math.max(Math.trunc(precision), 0), MAX_EXPRESSION_DECIMALS);
    const growthRate = growthRatePercent / 100;

    try {
      if (currentLoad < 0 || targetCapacity <= 0) {
        throw new Error('TOOL_EXECUTION_FAILED: currentLoad/targetCapacity 값이 유효하지 않습니다');
      }
      if (headroomPercent < 0 || headroomPercent > 90) {
        throw new Error('TOOL_EXECUTION_FAILED: headroomPercent는 0~90 사이여야 합니다');
      }

      const safeCapacity = targetCapacity * (1 - headroomPercent / 100);
      if (safeCapacity <= 0) {
        throw new Error('TOOL_EXECUTION_FAILED: headroomPercent가 너무 높아 실사용 용량이 0 이하가 됩니다');
      }

      let saturationPeriod: number | null = null;
      let projected = currentLoad;

      for (let i = 1; i <= forecastPeriods; i += 1) {
        projected = currentLoad * Math.pow(1 + growthRate, i);
        if (saturationPeriod === null && projected >= safeCapacity) {
          saturationPeriod = i;
          break;
        }
      }

      const safeLoadAtForecastEnd = Math.min((projected / targetCapacity) * 100, 100);
      const recommendation =
        saturationPeriod === null
          ? `예측 ${forecastPeriods}기간 내 임계 도달 없음. 예측 마지막 시점 부하율은 ${safeLoadAtForecastEnd.toFixed(safePrecision)}% 입니다.`
          : `예측 ${forecastPeriods}기간 이전에 ${saturationPeriod}기간 차에 안전 임계치(${safeCapacity.toFixed(safePrecision)}) 초과 가능성이 있습니다. 증설 또는 성장률 완화가 필요합니다.`;

      logger.info(
        `[estimateCapacityProjection] current=${currentLoad}, target=${targetCapacity}, growth=${growthRatePercent}%, forecast=${forecastPeriods}`
      );

      return {
        success: true,
        currentLoad: roundToPrecision(currentLoad, safePrecision),
        targetCapacity: roundToPrecision(targetCapacity, safePrecision),
        safeCapacity: roundToPrecision(safeCapacity, safePrecision),
        growthRatePercent: roundToPrecision(growthRatePercent, safePrecision),
        forecastPeriods,
        headroomPercent,
        projectedPeakLoad: roundToPrecision(projected, safePrecision),
        utilizationPercentAtForecastEnd: roundToPrecision(safeLoadAtForecastEnd, safePrecision),
        saturationPeriod,
        recommendation,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[estimateCapacityProjection] failed: ${message}`);
      return {
        success: false,
        error: `TOOL_EXECUTION_FAILED: ${message}`,
        recommendation: '입력 값(현재 부하/용량/성장률/예측 기간)을 점검한 뒤 다시 실행하세요.',
      };
    }
  },
});
