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
});
