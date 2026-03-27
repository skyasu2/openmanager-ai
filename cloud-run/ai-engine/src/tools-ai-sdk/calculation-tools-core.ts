type TokenType = 'number' | 'identifier' | 'operator' | 'paren' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export const MAX_EXPRESSION_LENGTH = 400;
export const MAX_VALUES_COUNT = 1000;
export const MAX_EXPRESSION_DECIMALS = 12;

const EXPR_REGEX = {
  numberStart: /[0-9.]/,
  number: /[0-9.]/,
  identifier: /[a-zA-Z_]/,
  identifierContinue: /[a-zA-Z0-9_]/,
};

function tokenizeExpression(expression: string): Token[] {
  const input = expression.trim();
  if (input.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(
      `TOOL_EXECUTION_FAILED: 수식 길이가 너무 깁니다 (max ${MAX_EXPRESSION_LENGTH}자)`
    );
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
            throw new Error(
              'TOOL_EXECUTION_FAILED: 숫자 표기 오류 (소수점 중복)'
            );
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
      while (
        index < input.length &&
        EXPR_REGEX.identifierContinue.test(input[index])
      ) {
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

export class ExpressionParser {
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
      throw new Error(
        `TOOL_EXECUTION_FAILED: 파싱 불완전 (${this.describeToken(this.peek())})`
      );
    }
    return value;
  }

  private parseExpression(): number {
    return this.parseAdditive();
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();

    while (this.matchOperator('+') || this.matchOperator('-')) {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      left = operator === '+' ? left + right : left - right;
    }

    return left;
  }

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

  private parsePower(): number {
    let left = this.parseUnary();
    if (this.matchOperator('^')) {
      this.consume();
      const right = this.parsePower();
      left = Math.pow(left, right);
    }
    return left;
  }

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

    throw new Error(
      `TOOL_EXECUTION_FAILED: 예기치 않은 토큰 ${this.describeToken(token)}`
    );
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

    if (!this.matchParen('(')) {
      throw new Error(`TOOL_EXECUTION_FAILED: 미지원 식별자 "${identifier}"`);
    }

    this.consume();
    const args: number[] = [];

    if (!this.matchParen(')')) {
      args.push(this.parseExpression());
      while (this.matchCommaOnly()) {
        this.consume();
        args.push(this.parseExpression());
      }
    }

    if (!this.matchParen(')')) {
      throw new Error(
        `TOOL_EXECUTION_FAILED: "${identifier}(...)"의 닫는 괄호가 없습니다`
      );
    }
    this.consume();

    return this.evaluateMathFunction(identifier, args, token.position);
  }

  private evaluateMathFunction(
    name: string,
    args: number[],
    position: number
  ): number {
    const first = args[0];
    const second = args[1];

    switch (name) {
      case 'sqrt':
        if (args.length !== 1) {
          throw new Error(
            `TOOL_EXECUTION_FAILED: sqrt는 1개 인자만 허용됩니다 (${position})`
          );
        }
        if (first < 0) {
          throw new Error(
            'TOOL_EXECUTION_FAILED: sqrt는 음수 값에 대해 사용할 수 없습니다'
          );
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
          throw new Error(
            `TOOL_EXECUTION_FAILED: ${name}는 1개 인자만 허용됩니다`
          );
        }
        if (name === 'floor') return Math.floor(first);
        if (name === 'ceil') return Math.ceil(first);
        return Math.round(first);

      case 'ln':
      case 'log':
        if (args.length !== 1 && !(name === 'log' && args.length === 2)) {
          throw new Error(
            `TOOL_EXECUTION_FAILED: ${name}는 1개 또는 2개 인자만 허용됩니다`
          );
        }
        if (name === 'ln') {
          if (first <= 0) {
            throw new Error(
              'TOOL_EXECUTION_FAILED: ln은 0 이하에 대해 정의되지 않습니다'
            );
          }
          return Math.log(first);
        }

        if (args.length === 1) {
          return Math.log10(first);
        }
        if (second <= 0 || first <= 0) {
          throw new Error(
            'TOOL_EXECUTION_FAILED: log(a, b)는 a, b가 0보다 커야 합니다'
          );
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
          throw new Error(
            `TOOL_EXECUTION_FAILED: ${name}는 최소 1개 인자가 필요합니다`
          );
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

export function roundToPrecision(value: number, precision: number): number {
  const safePrecision = Math.min(
    Math.max(Math.trunc(precision), 0),
    MAX_EXPRESSION_DECIMALS
  );
  const factor = 10 ** safePrecision;
  return Math.round(value * factor) / factor;
}

export function sortCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

export function computePercentile(sortedValues: number[], p: number): number {
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
