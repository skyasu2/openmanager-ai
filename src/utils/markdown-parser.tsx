'use client';

import React from 'react';
import { CodeExecutionBlock } from '@/components/ai/CodeExecutionBlock';

export interface ContentBlock {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/**
 * Parse markdown content into text and code blocks
 */
export function parseMarkdownContent(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim();
      if (textContent) {
        blocks.push({
          type: 'text',
          content: textContent,
        });
      }
    }

    // Add code block
    const language = match[1] || 'text';
    const code = (match[2] || '').trim();

    blocks.push({
      type: 'code',
      content: code,
      language,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last code block
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        type: 'text',
        content: textContent,
      });
    }
  }

  // If no code blocks found, return entire content as text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      type: 'text',
      content: content.trim(),
    });
  }

  return blocks;
}

/**
 * Check if content contains executable Python code
 */
export function hasExecutableCode(content: string): boolean {
  const pythonCodeRegex = /```(?:python|py)\n[\s\S]*?```/i;
  return pythonCodeRegex.test(content);
}

export interface RenderMarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Render markdown content with executable code blocks
 */
export function RenderMarkdownContent({
  content,
  className = '',
}: RenderMarkdownContentProps): React.ReactNode {
  const blocks = parseMarkdownContent(content);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          const isPython =
            block.language?.toLowerCase() === 'python' ||
            block.language?.toLowerCase() === 'py';

          return (
            <CodeExecutionBlock
              key={index}
              code={block.content}
              language={block.language || 'text'}
              showRunButton={isPython}
            />
          );
        }

        // Render text content with basic formatting
        return (
          <div
            key={index}
            className="whitespace-pre-wrap break-words text-chat leading-relaxed"
          >
            {renderFormattedText(block.content)}
          </div>
        );
      })}
    </div>
  );
}

const SAFE_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

function isSafeMarkdownLink(url: string): boolean {
  const trimmedUrl = url.trim();

  if (
    trimmedUrl.startsWith('/') ||
    trimmedUrl.startsWith('./') ||
    trimmedUrl.startsWith('../') ||
    trimmedUrl.startsWith('#')
  ) {
    return true;
  }

  // Disallow dangerous protocols like javascript:, data:, vbscript:
  const isProtocolUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmedUrl);
  if (isProtocolUrl) {
    try {
      const parsed = new URL(trimmedUrl);
      return SAFE_LINK_PROTOCOLS.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  // allow bare URLs and paths by treating them as relative/host-relative values
  return trimmedUrl.length > 0;
}

/**
 * 간단한 마크다운 링크 패턴을 파싱하여 React 요소로 변환합니다.
 * 형식: [텍스트](URL) -> <a href="URL">텍스트</a>
 */
export function parseMarkdownLinks(text: string): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const [fullMatch, linkText, rawUrl] = match;
    const safeRawUrl = rawUrl ?? '';
    const startIndex = match.index;
    const href = safeRawUrl.trim();

    if (startIndex > lastIndex) {
      parts.push(text.substring(lastIndex, startIndex));
    }

    if (isSafeMarkdownLink(href)) {
      parts.push(
        <a
          key={`link-${startIndex}-${linkText}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400 underline-offset-2 transition-colors"
        >
          {linkText}
        </a>
      );
    } else {
      parts.push(fullMatch);
    }

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Render inline content: bold, inline code, links
 */
function renderInlineContent(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/g);

  const renderBoldItalicText = (value: string, kp: string) => {
    // Split on **bold** and *italic* patterns (bold first to avoid conflict)
    const parts = value.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    if (parts.length === 1) return <span key={kp}>{value}</span>;
    return (
      <span key={kp}>
        {parts.map((p, i) => {
          if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
            return (
              <strong key={`${kp}-b-${i}`} className="font-semibold">
                {p.slice(2, -2)}
              </strong>
            );
          }
          if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
            return (
              <em key={`${kp}-i-${i}`} className="italic">
                {p.slice(1, -1)}
              </em>
            );
          }
          return <span key={`${kp}-t-${i}`}>{p}</span>;
        })}
      </span>
    );
  };

  const renderTextWithLinks = (value: string, kp: string) => {
    const linkParts = parseMarkdownLinks(value);
    return linkParts.map((linkPart, i) => {
      if (typeof linkPart === 'string') {
        return renderBoldItalicText(linkPart, `${kp}-text-${i}`);
      }
      return (
        <React.Fragment key={`${kp}-link-${i}`}>{linkPart}</React.Fragment>
      );
    });
  };

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-pink-600 dark:bg-gray-800 dark:text-pink-400"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return (
      <React.Fragment key={`${keyPrefix}-${index}`}>
        {renderTextWithLinks(part, `${keyPrefix}-${index}`)}
      </React.Fragment>
    );
  });
}

const HEADING_REGEX = /^(#{1,3})\s+(.+)$/;
const ORDERED_LIST_REGEX = /^(\d+)\.\s+(.+)$/;
const UNORDERED_LIST_REGEX = /^[-*]\s+(.+)$/;
const HR_REGEX = /^---+$/;

/**
 * Render text with full block-level markdown support:
 * headings (###/##/#), ordered/unordered lists, horizontal rules,
 * and inline formatting (bold, code, links).
 */
function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!listBuffer) return;
    const { ordered, items } = listBuffer;
    const Tag = ordered ? 'ol' : 'ul';
    const listClass = ordered
      ? 'my-1 ml-4 list-decimal space-y-0.5'
      : 'my-1 ml-4 list-disc space-y-0.5';
    nodes.push(
      <Tag key={key} className={listClass}>
        {items.map((item, i) => (
          <li key={i} className="text-chat leading-relaxed">
            {renderInlineContent(item, `${key}-li-${i}`)}
          </li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  lines.forEach((line, i) => {
    const key = `line-${i}`;

    // Horizontal rule
    if (HR_REGEX.test(line.trim())) {
      flushList(`list-before-hr-${i}`);
      nodes.push(<hr key={key} className="my-2 border-slate-200" />);
      return;
    }

    // Headings
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch) {
      flushList(`list-before-h-${i}`);
      const level = (headingMatch[1] ?? '').length;
      const headingText = headingMatch[2] ?? '';
      const headingClasses: Record<number, string> = {
        1: 'mt-3 mb-1 text-base font-bold text-slate-800',
        2: 'mt-2 mb-1 text-sm font-bold text-slate-700',
        3: 'mt-1.5 mb-0.5 text-sm font-semibold text-slate-600',
      };
      const cls = headingClasses[level] ?? headingClasses[3];
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      nodes.push(
        <Tag key={key} className={cls}>
          {renderInlineContent(headingText, key)}
        </Tag>
      );
      return;
    }

    // Ordered list item
    const orderedMatch = line.match(ORDERED_LIST_REGEX);
    if (orderedMatch) {
      if (listBuffer && !listBuffer.ordered) flushList(`list-switch-${i}`);
      if (!listBuffer) listBuffer = { ordered: true, items: [] };
      listBuffer.items.push(orderedMatch[2] ?? '');
      return;
    }

    // Unordered list item
    const unorderedMatch = line.match(UNORDERED_LIST_REGEX);
    if (unorderedMatch) {
      if (listBuffer?.ordered) flushList(`list-switch-${i}`);
      if (!listBuffer) listBuffer = { ordered: false, items: [] };
      listBuffer.items.push(unorderedMatch[1] ?? '');
      return;
    }

    // Empty line — flush pending list, add spacing
    if (line.trim() === '') {
      flushList(`list-before-empty-${i}`);
      nodes.push(<br key={key} />);
      return;
    }

    // Regular text line
    flushList(`list-before-text-${i}`);
    nodes.push(
      <span key={key} className="block leading-relaxed">
        {renderInlineContent(line, key)}
      </span>
    );
  });

  flushList('list-final');

  return <>{nodes}</>;
}
