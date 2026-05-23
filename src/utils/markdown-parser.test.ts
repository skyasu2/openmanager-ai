import { isValidElement, type ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  hasExecutableCode,
  parseMarkdownContent,
  parseMarkdownLinks,
  RenderMarkdownContent,
} from '@/utils/markdown-parser';

type RenderNode = ReactElement | string | number | null | undefined | boolean;

const hasAnchorNode = (node: RenderNode): boolean => {
  if (!node) return false;

  if (isValidElement(node)) {
    if (node.type === 'a') {
      return true;
    }

    const children = node.props?.children;
    if (!children) return false;
    const list = Array.isArray(children) ? children : [children];

    return list.some((child: RenderNode) => hasAnchorNode(child));
  }

  if (Array.isArray(node)) {
    return node.some((child) => hasAnchorNode(child));
  }

  return false;
};

const hasElementType = (node: RenderNode, type: string): boolean => {
  if (!node) return false;

  if (isValidElement(node)) {
    if (node.type === type) {
      return true;
    }

    const children = node.props?.children;
    if (!children) return false;
    const list = Array.isArray(children) ? children : [children];

    return list.some((child: RenderNode) => hasElementType(child, type));
  }

  if (Array.isArray(node)) {
    return node.some((child) => hasElementType(child, type));
  }

  return false;
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

describe('markdown parser legacy paths', () => {
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

  it('renders markdown links inside RenderMarkdownContent', () => {
    const rendered = RenderMarkdownContent({
      content: '[OpenManager](https://openmanager.ai)',
    });

    if (!isValidElement(rendered)) {
      throw new Error('Expected RenderMarkdownContent to return an element');
    }

    expect(hasAnchorNode(rendered)).toBe(true);
  });

  it('renders compact heading markers without leaking raw hash prefixes', () => {
    const rendered = RenderMarkdownContent({
      content: '##정상서버목록\n###CPU사용률80%미만\n1. **api-was-dc1-01**',
    });

    if (!isValidElement(rendered)) {
      throw new Error('Expected RenderMarkdownContent to return an element');
    }

    expect(hasElementType(rendered, 'h2')).toBe(true);
    expect(hasElementType(rendered, 'h3')).toBe(true);
  });
});
