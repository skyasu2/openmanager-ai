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
