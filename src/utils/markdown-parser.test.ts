import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  hasExecutableCode,
  normalizeAssistantMarkdown,
  parseMarkdownContent,
  parseMarkdownLinks,
  RenderMarkdownContent,
} from '@/utils/markdown-parser';

/**
 * RenderMarkdownContent 는 react-markdown 으로 렌더 시점에 마크다운을 파싱하므로,
 * 반환된 element 트리를 정적으로 순회하는 대신 HTML 로 렌더해서 검증합니다.
 */
const renderMarkdownHtml = (content: string): string => {
  const element = RenderMarkdownContent({ content });
  if (!isValidElement(element)) {
    throw new Error('Expected RenderMarkdownContent to return an element');
  }
  return renderToStaticMarkup(element as ReactElement);
};

describe('parseMarkdownLinks', () => {
  it('renders markdown links as anchor elements', () => {
    const parsed = parseMarkdownLinks(
      'Visit [OpenManager](https://openmanager.ai) for details.'
    );

    const links = parsed.filter(
      (node): node is ReactElement => isValidElement(node) && node.type === 'a'
    );
    const texts = parsed.filter((node) => typeof node === 'string');

    expect(links).toHaveLength(1);
    expect(links[0]?.props.href).toBe('https://openmanager.ai');
    expect(links[0]?.props.children).toBe('OpenManager');
    expect(texts.join('')).toContain('Visit ');
    expect(texts.join('')).toContain(' for details.');
  });

  it('blocks unsafe markdown links', () => {
    const parsed = parseMarkdownLinks('[xss](javascript:alert%281%29)');

    const links = parsed.filter(
      (node): node is ReactElement => isValidElement(node) && node.type === 'a'
    );

    expect(links).toHaveLength(0);
    expect(parsed).toEqual(['[xss](javascript:alert%281%29)']);
  });

  it('supports multiple links in one line', () => {
    const parsed = parseMarkdownLinks(
      'Docs: [Vercel](https://vercel.com) and [Next.js](https://nextjs.org)'
    );

    const links = parsed.filter(
      (node): node is ReactElement => isValidElement(node) && node.type === 'a'
    );

    expect(links).toHaveLength(2);
    expect(links[0]?.props.href).toBe('https://vercel.com');
    expect(links[1]?.props.href).toBe('https://nextjs.org');
  });
});

describe('markdown parser pure utilities', () => {
  const targetVariable = '$' + '{target}';

  it('preserves code block parsing behavior', () => {
    const blocks = parseMarkdownContent(
      'Hello\n```python\nprint("test")\n```\nbye'
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'text', content: 'Hello' });
    expect(blocks[1]).toMatchObject({
      type: 'code',
      language: 'python',
      content: 'print("test")',
    });
    expect(blocks[2]).toMatchObject({ type: 'text', content: 'bye' });
  });

  it('preserves shell scripts with command substitution and trailing lines', () => {
    const blocks = parseMarkdownContent(
      [
        '설명',
        '```bash',
        'filterServers() {',
        '  local target="$(printf "%s" "$1")"',
        `  if [[ -n "${targetVariable}" ]]; then`,
        `    echo "${targetVariable}"`,
        '  fi',
        '  echo "done"',
        '}',
        '```',
      ].join('\n')
    );

    expect(blocks[1]).toMatchObject({
      type: 'code',
      language: 'bash',
      content: `filterServers() {\n  local target="$(printf "%s" "$1")"\n  if [[ -n "${targetVariable}" ]]; then\n    echo "${targetVariable}"\n  fi\n  echo "done"\n}`,
    });
  });

  it('detects executable python code', () => {
    expect(hasExecutableCode('```python\nprint(1)\n```')).toBe(true);
    expect(hasExecutableCode('```js\nconsole.log(1)\n```')).toBe(false);
  });
});

describe('normalizeAssistantMarkdown', () => {
  it('splits an inline horizontal rule onto its own line', () => {
    const normalized = normalizeAssistantMarkdown('분석 --- ### 현황 요약');
    expect(normalized).toContain('\n---\n');
    expect(normalized).toMatch(/\n### 현황 요약/);
  });

  it('adds a space after a glued compact heading', () => {
    const normalized = normalizeAssistantMarkdown(
      '##정상서버목록\n###CPU사용률80%미만'
    );
    expect(normalized).toContain('## 정상서버목록');
    expect(normalized).toContain('### CPU사용률80%미만');
  });

  it('leaves GFM table separators untouched', () => {
    const table = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(normalizeAssistantMarkdown(table)).toBe(table);
  });

  it('splits a line-leading horizontal rule glued to text', () => {
    const normalized = normalizeAssistantMarkdown(
      '서킷 브레이커 도입\n--- 결론: 즉시 스케일아웃'
    );
    // 줄 시작 "--- 결론:" 의 "---" 가 단독 라인이 되어야 한다.
    expect(normalized).toMatch(/\n---\n/);
    expect(normalized).toMatch(/\n결론: 즉시 스케일아웃/);
  });

  it('splits a trailing horizontal rule at end of line', () => {
    const normalized = normalizeAssistantMarkdown(
      'CPU 70% 초과 시 자동 알림 설정 ---\n다음 단계: WAS 점검'
    );
    expect(normalized).toMatch(/설정\n\n---/);
    expect(normalized).not.toMatch(/설정 ---/);
  });

  it('splits a trailing horizontal rule inside a list item', () => {
    const normalized = normalizeAssistantMarkdown('- PagerDuty 연동 ---');
    expect(normalized).toMatch(/연동\n\n---/);
  });

  it('does not break a list bullet that is only dashes', () => {
    // "- ---" 의 불릿("-")은 보존되어야 한다 (직전 문자가 '-' 라 규칙 제외).
    expect(normalizeAssistantMarkdown('- ---')).toBe('- ---');
  });

  it('trims edge spaces inside bold delimiters', () => {
    const normalized = normalizeAssistantMarkdown(
      '**api-was-dc1-01 서버가 현재 **'
    );
    expect(normalized).toContain('**api-was-dc1-01 서버가 현재**');
  });

  it('preserves valid bold and internal spaces', () => {
    expect(normalizeAssistantMarkdown('**api-was-dc1-01**')).toBe(
      '**api-was-dc1-01**'
    );
    expect(normalizeAssistantMarkdown('**CPU 81% 초과**')).toBe(
      '**CPU 81% 초과**'
    );
  });

  it('removes empty bold artifacts', () => {
    expect(normalizeAssistantMarkdown('제외하고,****로 트래픽')).toBe(
      '제외하고,로 트래픽'
    );
  });

  it('leaves a standalone horizontal rule untouched', () => {
    const hr = '위 분석\n\n---\n\n아래 결론';
    expect(normalizeAssistantMarkdown(hr)).toBe(hr);
  });
});

describe('RenderMarkdownContent', () => {
  it('renders markdown links as anchors', () => {
    const html = renderMarkdownHtml('[OpenManager](https://openmanager.ai)');
    expect(html).toContain('<a ');
    expect(html).toContain('href="https://openmanager.ai"');
  });

  it('renders compact heading markers without leaking raw hash prefixes', () => {
    const html = renderMarkdownHtml(
      '##정상서버목록\n###CPU사용률80%미만\n1. **api-was-dc1-01**'
    );

    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).not.toContain('##정상서버목록');
  });

  it('renders an inline horizontal rule + heading flattened by the AI Engine', () => {
    const html = renderMarkdownHtml('분석 --- ### 현황 요약');

    expect(html).toContain('<hr');
    expect(html).toContain('<h3');
    expect(html).toContain('현황 요약');
    // 평탄화된 마크다운 토큰이 literal 로 노출되지 않아야 한다.
    expect(html).not.toContain('--- ###');
  });
});
